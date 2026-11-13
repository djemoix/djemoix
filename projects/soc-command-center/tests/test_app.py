from fastapi.testclient import TestClient
from app import create_app
import sqlite3


def client(tmp_path, seed=False):
    test_client = TestClient(create_app(tmp_path / "alerts.db", seed_demo=seed))
    return test_client


def payload(title="Windows failed sign-ins", severity="high"):
    return {"title": title, "source": "Lab Windows", "severity": severity, "asset": "LAB-01", "src_ip": "192.0.2.10"}


def test_health_static_and_empty_summary(tmp_path):
    with client(tmp_path) as c:
        assert c.get("/").status_code == 200
        assert "SOC Command Center" in c.get("/").text
        assert c.get("/static/app.js").status_code == 200
        assert c.get("/api/health").json()["status"] == "ok"
        assert c.get("/api/summary").json()["total_alerts"] == 0


def test_seed_demo_only_once(tmp_path):
    with client(tmp_path, seed=True) as c:
        assert c.get("/api/summary").json()["total_alerts"] == 8
    with client(tmp_path, seed=True) as c:
        assert c.get("/api/summary").json()["total_alerts"] == 8


def test_create_filter_update_and_summary(tmp_path):
    with client(tmp_path) as c:
        a = c.post("/api/alerts", json=payload()).json()
        assert a["id"] == 1 and a["status"] == "new"
        c.post("/api/alerts", json=payload("Firewall config update", "low"))
        assert len(c.get("/api/alerts", params={"severity": "high"}).json()) == 1
        assert len(c.get("/api/alerts", params={"q": "LAB-01"}).json()) == 2
        assert len(c.get("/api/alerts", params={"status": "new", "limit": 1}).json()) == 1
        assert c.get("/api/summary").json()["high_priority"] == 1
        updated = c.patch("/api/alerts/1", json={"status": "resolved"}).json()
        assert updated["status"] == "resolved"
        assert c.get("/api/summary").json()["active_alerts"] == 1
        assert len(c.get("/api/alerts", params={"status": "resolved"}).json()) == 1


def test_input_validation_and_missing_alert(tmp_path):
    with client(tmp_path) as c:
        assert c.post("/api/alerts", json=payload(severity="extreme")).status_code == 422
        assert c.post("/api/alerts", json=payload(title="x")).status_code == 422
        assert c.get("/api/alerts", params={"limit": 201}).status_code == 422
        assert c.patch("/api/alerts/400", json={"status": "resolved"}).status_code == 404
        assert c.patch("/api/alerts/1", json={"status": "malicious"}).status_code == 422


def test_create_case_link_and_update(tmp_path):
    with client(tmp_path) as c:
        a = c.post("/api/alerts", json=payload()).json()
        r = c.post("/api/incidents", json={"title": "Investigate sign-ins", "severity": "high", "alert_ids": [a["id"]]})
        assert r.status_code == 201
        case = r.json()
        alert = c.get("/api/alerts").json()[0]
        assert alert["incident_id"] == case["id"]
        assert alert["status"] == "investigating"
        assert c.get("/api/summary").json()["open_cases"] == 1
        assert c.get("/api/incidents").json()[0]["alert_count"] == 1
        updated = c.patch("/api/incidents/1", json={"status": "closed", "notes": "False alarm - user confirmed"}).json()
        assert updated["status"] == "closed"
        assert updated["notes"] == "False alarm - user confirmed"
        assert c.get("/api/summary").json()["open_cases"] == 0


def test_case_conflict_and_rollback(tmp_path):
    with client(tmp_path) as c:
        a = c.post("/api/alerts", json=payload()).json()
        body = {"title": "Case title", "alert_ids": [a["id"], 999]}
        assert c.post("/api/incidents", json=body).status_code == 409
        assert c.get("/api/incidents").json() == []
        body["alert_ids"] = [a["id"]]
        assert c.post("/api/incidents", json=body).status_code == 201
        assert c.post("/api/incidents", json=body).status_code == 409
        assert len(c.get("/api/incidents").json()) == 1


def test_case_update_validation(tmp_path):
    with client(tmp_path) as c:
        assert c.patch("/api/incidents/1", json={"status": "open"}).status_code == 404
        c.post("/api/incidents", json={"title": "Case zero"})
        assert c.patch("/api/incidents/1", json={}).status_code == 422
        assert c.patch("/api/incidents/1", json={"status": "invalid"}).status_code == 422


def test_sql_injection_is_treated_as_text(tmp_path):
    with client(tmp_path) as c:
        c.post("/api/alerts", json=payload(title="normal"))
        assert c.get("/api/alerts", params={"q": "' OR 1=1 --"}).json() == []
        assert c.get("/api/summary").json()["total_alerts"] == 1
