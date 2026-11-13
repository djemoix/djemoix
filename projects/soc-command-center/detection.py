"""Small, testable correlation rules for normalized Linux authentication telemetry.

These are indicators for analyst triage, not proof of compromise.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import sqlite3

RULES = {
    "ssh_failed": (10, 5, "high", "Repeated SSH authentication failures"),
    "sudo_auth_failure": (3, 5, "medium", "Repeated sudo authentication failures"),
}


def correlate(db: sqlite3.Connection, *, category: str, asset: str, src_ip: str,
              account: str, event_time: datetime) -> bool:
    """Create one triage alert per rule/group per cooldown window. Return True if emitted."""
    if category not in RULES:
        return False
    threshold, minutes, severity, title = RULES[category]
    if category == "ssh_failed" and not src_ip:
        return False
    # Avoid merging different local sudo identities. SSH rules aggregate by source IP.
    group_key = src_ip if category == "ssh_failed" else account
    if not group_key:
        return False
    group = f"{category}\0{asset}\0{group_key}"
    start = (event_time - timedelta(minutes=minutes)).isoformat(timespec="seconds")
    end = event_time.isoformat(timespec="seconds")
    group_col = "src_ip" if category == "ssh_failed" else "account"
    count = db.execute(
        f"SELECT COUNT(*) FROM journal_events WHERE category=? AND asset=? AND {group_col}=? "
        "AND event_time>=? AND event_time<=?",
        (category, asset, group_key, start, end),
    ).fetchone()[0]
    if count < threshold:
        return False
    previous = db.execute("SELECT last_alert_at FROM detector_state WHERE group_key=?", (group,)).fetchone()
    if previous and event_time - datetime.fromisoformat(previous["last_alert_at"]) < timedelta(minutes=minutes):
        return False
    details = (f"Observed {count} failed SSH authentication events within {minutes} minutes "
               f"from {src_ip}; investigate account and network context. MITRE ATT&CK T1110; "
               "not proof of compromise.") if category == "ssh_failed" else (
               f"Observed {count} sudo authentication failures for local account {account} "
               f"within {minutes} minutes; confirm maintenance and user context."
               )
    db.execute(
        "INSERT INTO alerts(title, source, severity, asset, src_ip, details, event_time, origin) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (title, "Linux journal", severity, asset, src_ip, details, end, "linux-agent"),
    )
    db.execute("INSERT INTO detector_state(group_key,last_alert_at) VALUES(?,?) "
               "ON CONFLICT(group_key) DO UPDATE SET last_alert_at=excluded.last_alert_at", (group, end))
    return True
