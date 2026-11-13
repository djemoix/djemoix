"""SOC Command Center: local-only triage, incidents, and Linux authentication ingestion."""
from __future__ import annotations

from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
import secrets
import ipaddress
from pathlib import Path
from typing import Literal
import os
import sqlite3

from fastapi import FastAPI, HTTPException, Query, Header, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, AwareDatetime, field_validator
from detection import correlate

ROOT = Path(__file__).resolve().parent
SEVERITIES = ("critical", "high", "medium", "low")
ALERT_STATUSES = ("new", "investigating", "resolved", "false_positive")
CASE_STATUSES = ("open", "investigating", "closed")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class AlertCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    source: str = Field(min_length=2, max_length=80)
    severity: Literal["critical", "high", "medium", "low"]
    asset: str = Field(default="", max_length=120)
    src_ip: str = Field(default="", max_length=60)
    details: str = Field(default="", max_length=2000)


class LinuxEvent(BaseModel):
    event_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    event_time: AwareDatetime
    asset: str = Field(min_length=1, max_length=120)
    category: Literal["ssh_failed", "sudo_auth_failure"]
    src_ip: str = Field(default="", max_length=45)
    account: str = Field(min_length=1, max_length=120)

    @field_validator("src_ip")
    @classmethod
    def validate_ip(cls, value: str) -> str:
        if not value:
            return value
        return str(ipaddress.ip_address(value))


class LinuxIngest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=120)
    events: list[LinuxEvent] = Field(max_length=100)


class AlertUpdate(BaseModel):
    status: Literal["new", "investigating", "resolved", "false_positive"]


class CaseCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(default="", max_length=3000)
    severity: Literal["critical", "high", "medium", "low"] = "medium"
    alert_ids: list[int] = Field(default_factory=list, max_length=100)


class CaseUpdate(BaseModel):
    status: Literal["open", "investigating", "closed"] | None = None
    notes: str | None = Field(default=None, max_length=5000)


def create_app(db_path: str | Path | None = None, *, seed_demo: bool = True,
               data_mode: Literal["demo", "manual", "live"] | None = None,
               ingest_token: str | None = None) -> FastAPI:
    mode = data_mode or ("demo" if seed_demo else "manual")
    if mode == "live":
        seed_demo = False
    token = ingest_token if ingest_token is not None else os.environ.get("SOC_INGEST_TOKEN", "")
    if mode == "live" and len(token) < 32:
        raise ValueError("SOC_DATA_MODE=live requires SOC_INGEST_TOKEN with at least 32 characters")
    default_name = "soc-live.db" if mode == "live" else "soc.db"
    database = Path(db_path or os.environ.get("SOC_DB_PATH", ROOT / "data" / default_name))

    @contextmanager
    def connection():
        database.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(database, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def initialize():
        with connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL, description TEXT NOT NULL,
                    severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
                    notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL, source TEXT NOT NULL,
                    severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
                    asset TEXT NOT NULL DEFAULT '', src_ip TEXT NOT NULL DEFAULT '',
                    details TEXT NOT NULL DEFAULT '', event_time TEXT NOT NULL,
                    incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
                CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
                CREATE INDEX IF NOT EXISTS idx_alerts_incident ON alerts(incident_id);
                CREATE TABLE IF NOT EXISTS journal_events (
                    event_id TEXT PRIMARY KEY, event_time TEXT NOT NULL,
                    asset TEXT NOT NULL, category TEXT NOT NULL,
                    src_ip TEXT NOT NULL, account TEXT NOT NULL,
                    ingested_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_journal_correlation
                    ON journal_events(category,asset,src_ip,account,event_time);
                CREATE TABLE IF NOT EXISTS detector_state (
                    group_key TEXT PRIMARY KEY, last_alert_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS linux_agents (
                    agent_id TEXT PRIMARY KEY, last_seen TEXT NOT NULL,
                    events_accepted INTEGER NOT NULL DEFAULT 0
                );
            """)
            # Non-destructive migration for databases created by the v0.1 MVP.
            columns = {r["name"] for r in db.execute("PRAGMA table_info(alerts)")}
            if "origin" not in columns:
                db.execute("ALTER TABLE alerts ADD COLUMN origin TEXT NOT NULL DEFAULT 'demo'")
            if mode == "live" and db.execute(
                "SELECT COUNT(*) FROM alerts WHERE origin != 'linux-agent'"
            ).fetchone()[0]:
                raise RuntimeError(
                    "Live mode database contains demo/manual alerts. Use the separate soc-live.db "
                    "or a clean SOC_DB_PATH to prevent presenting synthetic alerts as real."
                )
            if seed_demo and db.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0:
                samples = [
                    ("Repeated Windows logon failures", "Windows Security", "high", "WS-FIN-07", "198.51.100.24", "Event 4625 · 38 failed attempts / 12 min"),
                    ("Suspicious PowerShell process", "Sysmon", "critical", "WS-HR-02", "", "Review process tree and signed script context"),
                    ("Unusual VPN authentication", "VPN Gateway", "medium", "VPN-EDGE", "203.0.113.12", "Logon from unfamiliar source; correlation required"),
                    ("Endpoint malware alert", "EDR", "high", "LAP-ENG-04", "", "Demo alert; no actual malicious binary"),
                    ("Excessive DNS queries", "DNS Resolver", "medium", "DNS-01", "192.0.2.28", "Investigate domain reputation and query baseline"),
                    ("Admin account sign-in", "Windows Security", "low", "DC-01", "192.0.2.40", "Event 4672; confirm approved maintenance"),
                    ("Web application error spike", "Web Logs", "low", "WEB-02", "203.0.113.88", "Correlate HTTP errors and deploy window"),
                    ("Repeated SSH login attempts", "Linux Auth", "high", "APP-01", "198.51.100.19", "Synthetic lab authentication telemetry"),
                ]
                start = datetime.now(timezone.utc)
                db.executemany("""
                    INSERT INTO alerts(title,source,severity,asset,src_ip,details,event_time)
                    VALUES(?,?,?,?,?,?,?)
                """, [(*x, (start - timedelta(minutes=(i + 1) * 7)).isoformat(timespec="seconds")) for i, x in enumerate(samples)])

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize()
        yield

    api = FastAPI(title="SOC Command Center", version="0.2.0", lifespan=lifespan,
                  description="Local-first SOC; live Linux journal ingestion requires a shared token. "
                              "Dashboard/analyst APIs are not authenticated: localhost-only lab use.")
    api.mount("/static", StaticFiles(directory=ROOT / "web"), name="static")

    @api.get("/", include_in_schema=False)
    def index():
        return FileResponse(ROOT / "web" / "index.html")

    @api.get("/api/health")
    def health():
        return {"status": "ok", "mode": mode, "version": "0.2.0",
                "source": "Linux journald" if mode == "live" else "Synthetic / manual"}

    @api.get("/api/telemetry")
    def telemetry():
        with connection() as db:
            since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(timespec="seconds")
            count = db.execute("SELECT COUNT(*) FROM journal_events WHERE event_time>=?", (since,)).fetchone()[0]
            agents = [dict(r) for r in db.execute("SELECT * FROM linux_agents ORDER BY last_seen DESC").fetchall()]
        now = datetime.now(timezone.utc)
        for agent in agents:
            agent["online"] = (now - datetime.fromisoformat(agent["last_seen"])).total_seconds() < 120
        return {"mode": mode, "events_24h": count, "agents": agents}

    @api.post("/api/ingest/linux")
    def ingest_linux(payload: LinuxIngest, x_agent_token: str = Header(default="")):
        if mode != "live":
            raise HTTPException(403, "Linux ingestion requires SOC_DATA_MODE=live")
        if not x_agent_token or not secrets.compare_digest(token, x_agent_token):
            raise HTTPException(401, "Invalid agent token")
        now = datetime.now(timezone.utc)
        # Ingestion is atomic; a failed batch cannot advance the accepted-events count.
        accepted = 0
        created = 0
        with connection() as db:
            for event in sorted(payload.events, key=lambda e: (e.event_time, e.event_id)):
                when = event.event_time.astimezone(timezone.utc)
                if when > now + timedelta(minutes=5) or when < now - timedelta(days=30):
                    raise HTTPException(422, "Event timestamp out of allowed range")
                if event.asset != payload.agent_id:
                    raise HTTPException(422, "Agent identity does not match asset")
                if event.category == "ssh_failed" and not event.src_ip:
                    raise HTTPException(422, "SSH failures require a source IP")
                cursor = db.execute(
                    "INSERT OR IGNORE INTO journal_events(event_id,event_time,asset,category,src_ip,account,ingested_at) "
                    "VALUES(?,?,?,?,?,?,?)",
                    (event.event_id, when.isoformat(timespec="seconds"), event.asset,
                     event.category, event.src_ip, event.account, utc_now()),
                )
                if cursor.rowcount == 0:
                    continue
                accepted += 1
                if correlate(db, category=event.category, asset=event.asset,
                             src_ip=event.src_ip, account=event.account, event_time=when):
                    created += 1
            db.execute("INSERT INTO linux_agents(agent_id,last_seen,events_accepted) VALUES(?,?,?) "
                       "ON CONFLICT(agent_id) DO UPDATE SET last_seen=excluded.last_seen, "
                       "events_accepted=events_accepted+excluded.events_accepted",
                       (payload.agent_id, utc_now(), accepted))
            # Only normalized, minimal event metadata is retained for up to 30 days.
            old = (now - timedelta(days=30)).isoformat(timespec="seconds")
            db.execute("DELETE FROM journal_events WHERE event_time<?", (old,))
        return {"accepted": accepted, "duplicates": len(payload.events) - accepted,
                "alerts_created": created}

    @api.get("/api/summary")
    def summary():
        with connection() as db:
            total = db.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
            pending = db.execute("SELECT COUNT(*) FROM alerts WHERE status IN ('new','investigating')").fetchone()[0]
            high = db.execute("SELECT COUNT(*) FROM alerts WHERE severity IN ('critical','high') AND status IN ('new','investigating')").fetchone()[0]
            open_cases = db.execute("SELECT COUNT(*) FROM incidents WHERE status!='closed'").fetchone()[0]
            severity_rows = db.execute("SELECT severity, COUNT(*) AS count FROM alerts WHERE status IN ('new','investigating') GROUP BY severity").fetchall()
        counts = {s: 0 for s in SEVERITIES}
        counts.update({r["severity"]: r["count"] for r in severity_rows})
        return {"total_alerts": total, "active_alerts": pending, "high_priority": high,
                "open_cases": open_cases, "by_severity": counts}

    @api.get("/api/alerts")
    def list_alerts(
        severity: Literal["critical", "high", "medium", "low"] | None = None,
        status_filter: Literal["new", "investigating", "resolved", "false_positive"] | None = Query(None, alias="status"),
        q: str = Query("", max_length=100), limit: int = Query(100, ge=1, le=200),
    ):
        clauses, params = [], []
        if severity:
            clauses.append("severity=?")
            params.append(severity)
        if status_filter:
            clauses.append("status=?")
            params.append(status_filter)
        if q:
            clauses.append("(title LIKE ? OR source LIKE ? OR asset LIKE ? OR src_ip LIKE ?)")
            params.extend(["%" + q + "%"] * 4)
        query = "SELECT * FROM alerts" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY event_time DESC, id DESC LIMIT ?"
        with connection() as db:
            return [dict(row) for row in db.execute(query, [*params, limit]).fetchall()]

    @api.post("/api/alerts", status_code=status.HTTP_201_CREATED)
    def create_alert(payload: AlertCreate):
        if mode == "live":
            raise HTTPException(403, "Manual/synthetic alerts disabled in live mode")
        with connection() as db:
            cursor = db.execute("""INSERT INTO alerts(title,source,severity,asset,src_ip,details,event_time)
                           VALUES(?,?,?,?,?,?,?)""", (payload.title, payload.source, payload.severity,
                            payload.asset, payload.src_ip, payload.details, utc_now()))
            return dict(db.execute("SELECT * FROM alerts WHERE id=?", (cursor.lastrowid,)).fetchone())

    @api.patch("/api/alerts/{alert_id}")
    def update_alert(alert_id: int, payload: AlertUpdate):
        with connection() as db:
            cursor = db.execute("UPDATE alerts SET status=? WHERE id=?", (payload.status, alert_id))
            if not cursor.rowcount:
                raise HTTPException(404, "Alert not found")
            return dict(db.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone())

    @api.get("/api/incidents")
    def list_cases():
        with connection() as db:
            rows = db.execute("""SELECT i.*, COUNT(a.id) AS alert_count FROM incidents i
                     LEFT JOIN alerts a ON a.incident_id=i.id
                     GROUP BY i.id ORDER BY i.updated_at DESC,i.id DESC""").fetchall()
            return [dict(r) for r in rows]

    @api.post("/api/incidents", status_code=status.HTTP_201_CREATED)
    def create_case(payload: CaseCreate):
        ids = list(dict.fromkeys(payload.alert_ids))
        with connection() as db:
            if ids:
                placeholders = ",".join("?" for _ in ids)
                rows = db.execute(f"SELECT id,incident_id FROM alerts WHERE id IN ({placeholders})", ids).fetchall()
                if len(rows) != len(ids) or any(r["incident_id"] is not None for r in rows):
                    raise HTTPException(409, "Alert missing or already assigned to a case")
            now = utc_now()
            cursor = db.execute("""INSERT INTO incidents(title,description,severity,status,created_at,updated_at)
                           VALUES(?,?,?,'open',?,?)""", (payload.title, payload.description, payload.severity, now, now))
            case_id = cursor.lastrowid
            for alert_id in ids:
                db.execute("UPDATE alerts SET incident_id=?,status='investigating' WHERE id=?", (case_id, alert_id))
            return dict(db.execute("SELECT * FROM incidents WHERE id=?", (case_id,)).fetchone())

    @api.patch("/api/incidents/{case_id}")
    def update_case(case_id: int, payload: CaseUpdate):
        if payload.status is None and payload.notes is None:
            raise HTTPException(422, "Supply status and/or notes")
        with connection() as db:
            current = db.execute("SELECT * FROM incidents WHERE id=?", (case_id,)).fetchone()
            if current is None:
                raise HTTPException(404, "Case not found")
            db.execute("UPDATE incidents SET status=?,notes=?,updated_at=? WHERE id=?",
                       (payload.status or current["status"],
                        payload.notes if payload.notes is not None else current["notes"], utc_now(), case_id))
            return dict(db.execute("SELECT * FROM incidents WHERE id=?", (case_id,)).fetchone())

    return api


app = create_app(
    seed_demo=os.getenv("SOC_SEED_DEMO", "1") == "1",
    data_mode=os.getenv("SOC_DATA_MODE") or None,
)
