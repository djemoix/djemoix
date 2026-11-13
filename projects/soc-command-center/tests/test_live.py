"""Tests validate data provenance, authentication and correlation using synthetic fixtures.

Fixtures are not real user telemetry, and do not assert a live Linux host connection.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import sqlite3
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from app import create_app
from linux_agent import parse_entry, poll, load_cursor, collect

TOKEN = "a" * 48


def live_client(tmp_path):
    return TestClient(create_app(tmp_path / "live.db", data_mode="live", ingest_token=TOKEN))


def make_event(i, *, category="ssh_failed", ip="192.0.2.9", asset="lab-host", account="analyst", when=None):
    when = when or (datetime.now(timezone.utc) - timedelta(minutes=1))
    return {
        "event_id": hashlib.sha256(f"{category}-{i}-{asset}-{ip}".encode()).hexdigest(),
        "event_time": (when + timedelta(seconds=i)).isoformat(timespec="seconds"),
        "asset": asset, "category": category, "src_ip": ip,
        "account": account,
    }


def ingest(c, events, token=TOKEN, agent="lab-host"):
    return c.post("/api/ingest/linux", json={"agent_id": agent, "events": events},
                  headers={"X-Agent-Token": token})


def test_live_requires_secret_and_never_seeds_demo(tmp_path):
    with pytest.raises(ValueError):
        create_app(tmp_path / "live.db", data_mode="live", ingest_token="short")
    with live_client(tmp_path) as c:
        assert c.get("/api/health").json()["mode"] == "live"
        assert c.get("/api/summary").json()["total_alerts"] == 0
        assert c.get("/api/telemetry").json() == {"mode": "live", "events_24h": 0, "agents": []}
        assert c.post("/api/alerts", json={"title": "Fake alert", "source": "Manual", "severity": "low"}).status_code == 403
        assert ingest(c, [], token="wrong").status_code == 401
        assert ingest(c, [], token="").status_code == 401
        good = ingest(c, [])
        assert good.status_code == 200
        assert c.get("/api/telemetry").json()["agents"][0]["online"] is True


def test_ssh_threshold_dedup_and_incident_workflow(tmp_path):
    events = [make_event(i) for i in range(10)]
    with live_client(tmp_path) as c:
        r = ingest(c, events[:9])
        assert r.json()["accepted"] == 9 and r.json()["alerts_created"] == 0
        r = ingest(c, [events[9]])
        assert r.json()["alerts_created"] == 1
        assert ingest(c, events).json()["accepted"] == 0
        assert c.get("/api/summary").json()["total_alerts"] == 1
        alert = c.get("/api/alerts").json()[0]
        assert alert["origin"] == "linux-agent"
        assert alert["src_ip"] == "192.0.2.9" and alert["severity"] == "high"
        incident = c.post("/api/incidents", json={"title": "Investigate SSH", "alert_ids": [alert["id"]]}).json()
        assert incident["status"] == "open"
        assert c.patch(f"/api/alerts/{alert['id']}", json={"status": "investigating"}).status_code == 200
        assert c.get("/api/telemetry").json()["events_24h"] == 10
        assert c.get("/api/telemetry").json()["agents"][0]["events_accepted"] == 10
        with sqlite3.connect(tmp_path / "live.db") as db:
            assert db.execute("SELECT COUNT(*) FROM journal_events").fetchone()[0] == 10


def test_sudo_threshold_separate_hosts_and_invalid_payload(tmp_path):
    with live_client(tmp_path) as c:
        one = [make_event(i, category="sudo_auth_failure", ip="", account="alice") for i in range(2)]
        assert ingest(c, one).json()["alerts_created"] == 0
        another = make_event(2, category="sudo_auth_failure", ip="", account="alice")
        assert ingest(c, [another]).json()["alerts_created"] == 1
        assert c.get("/api/alerts").json()[0]["severity"] == "medium"
        # A second sudo identity must not be mixed into the first identity's threshold.
        assert ingest(c, [make_event(12, category="sudo_auth_failure", ip="", account="bob")]).json()["alerts_created"] == 0
        assert ingest(c, [make_event(13, category="ssh_failed", ip="invalid-ip")]).status_code == 422
        assert ingest(c, [make_event(13, category="ssh_failed", asset="other-host")]).status_code == 422
        old = make_event(10, when=datetime.now(timezone.utc) - timedelta(days=32))
        assert ingest(c, [old]).status_code == 422
        assert ingest(c, [make_event(0, when=datetime.now(timezone.utc) + timedelta(days=1))]).status_code == 422
        assert c.get("/api/summary").json()["total_alerts"] == 1


def test_batch_atomicity_on_bad_event(tmp_path):
    with live_client(tmp_path) as c:
        e = make_event(0)
        bad = make_event(1, asset="evil-host")
        resp = ingest(c, [e, bad])
        assert resp.status_code == 422
        assert c.get("/api/telemetry").json()["events_24h"] == 0
        assert ingest(c, [e]).json()["accepted"] == 1


def journal_entry(msg, source="sshd", i=1, stamp=None):
    when = stamp if stamp is not None else int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    return {"SYSLOG_IDENTIFIER": source, "MESSAGE": msg,
            "__REALTIME_TIMESTAMP": str(when), "__CURSOR": f"cursor-{i}"}


def test_parser_ssh_valid_ip_only_and_no_raw_message():
    line = journal_entry("Failed password for invalid user fake from 2001:db8::5 port 22 ssh2")
    result = parse_entry(line, "lab-host")
    assert result["category"] == "ssh_failed"
    assert result["src_ip"] == "2001:db8::5" and result["account"] == "fake"
    assert "MESSAGE" not in result and "Failed password" not in json.dumps(result)
    assert parse_entry(journal_entry("Accepted password for user from 192.0.2.9 port 22 ssh2"), "lab-host") is None
    assert parse_entry(journal_entry("Failed password for user from not-an-ip port 22 ssh2"), "lab-host") is None
    assert parse_entry(journal_entry("Failed password for user from 192.0.2.9 port 22 ssh2", source="browser"), "lab-host") is None
    assert parse_entry({"SYSLOG_IDENTIFIER": "sshd", "MESSAGE": "error"}, "lab-host") is None


def test_parser_sudo_and_journal_command(tmp_path):
    line = journal_entry("pam_unix(sudo:auth): authentication failure; logname= user=alice", "sudo")
    result = parse_entry(line, "lab-host")
    assert result["category"] == "sudo_auth_failure" and result["src_ip"] == ""
    fake = type("Result", (), {"returncode": 0, "stdout": json.dumps(line) + "\n", "stderr": ""})()
    with patch("linux_agent.subprocess.run", return_value=fake) as sub:
        events, cursor = collect(None, "lab-host")
        assert len(events) == 1 and cursor == "cursor-1"
        assert sub.call_args.args[0][-2:] == ["--since", "5 minutes ago"]
        collect("cursor-1", "lab-host")
        assert sub.call_args.args[0][-2:] == ["--after-cursor", "cursor-1"]


def test_cursor_advances_only_after_success_and_duplicate_retry(tmp_path):
    state = tmp_path / "cursor.json"
    events = [make_event(1)]
    with patch("linux_agent.collect", return_value=(events, "new-cursor")), \
         patch("linux_agent.send_batch", side_effect=ConnectionError("offline")):
        with pytest.raises(ConnectionError):
            poll(base_url="http://127.0.0.1:8000", token=TOKEN, agent_id="lab-host", state_path=state)
    assert load_cursor(state) is None
    with patch("linux_agent.collect", return_value=(events, "new-cursor")), \
         patch("linux_agent.send_batch", return_value={"accepted": 1, "alerts_created": 0}):
        result = poll(base_url="http://127.0.0.1:8000", token=TOKEN, agent_id="lab-host", state_path=state)
    assert result["accepted"] == 1
    assert load_cursor(state) == "new-cursor"


def test_live_refuses_database_containing_demo_alerts(tmp_path):
    database = tmp_path / "shared.db"
    with TestClient(create_app(database, seed_demo=True)) as c:
        assert c.get("/api/summary").json()["total_alerts"] == 8
    with pytest.raises(RuntimeError, match="demo/manual alerts"):
        with TestClient(create_app(database, data_mode="live", ingest_token=TOKEN)):
            pass


def test_demo_rejects_live_ingestion(tmp_path):
    with TestClient(create_app(tmp_path / "demo.db", seed_demo=True)) as c:
        assert c.get("/api/summary").json()["total_alerts"] == 8
        assert ingest(c, []).status_code == 403
