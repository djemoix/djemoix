"""Read-only Linux journald collector for the local SOC Command Center MVP.

Only normalized SSH and sudo authentication metadata is sent, not raw log messages.
No root privileges are requested, and cursor state advances only after HTTP success.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
from urllib import error, request

FAILED_SSH = re.compile(
    r"Failed (?:password|publickey|keyboard-interactive/pam) for (?:invalid user )?"
    r"(?P<account>[^\s]+) from (?P<ip>[^\s]+) port \d+", re.IGNORECASE,
)
FAILED_SUDO = re.compile(r"pam_unix\(sudo:auth\):\s*authentication failure", re.IGNORECASE)
ACCOUNT = re.compile(r"\buser=(?P<account>[^\s;]+)")


def parse_entry(entry: dict, agent_id: str) -> dict | None:
    """Extract minimal event metadata from a journald JSON record."""
    message = entry.get("MESSAGE")
    source = " ".join(str(entry.get(k, "")) for k in
                      ("SYSLOG_IDENTIFIER", "_COMM", "_SYSTEMD_UNIT")).lower()
    stamp = entry.get("__REALTIME_TIMESTAMP")
    if not isinstance(message, str) or not stamp:
        return None
    try:
        when = datetime.fromtimestamp(int(stamp) / 1_000_000, tz=timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        return None
    category, ip, account = None, "", ""
    if "sshd" in source or source.strip().startswith("ssh ") or "ssh.service" in source:
        match = FAILED_SSH.search(message)
        if match:
            try:
                ip = str(ipaddress.ip_address(match.group("ip")))
            except ValueError:
                return None
            category, account = "ssh_failed", match.group("account")
    elif "sudo" in source and FAILED_SUDO.search(message):
        match = ACCOUNT.search(message)
        account = match.group("account") if match else "unknown"
        category = "sudo_auth_failure"
    if not category:
        return None
    cursor = str(entry.get("__CURSOR") or "")
    fingerprint = "\x00".join([agent_id, cursor, str(stamp), message])
    return {
        "event_id": hashlib.sha256(fingerprint.encode("utf-8")).hexdigest(),
        "event_time": when.isoformat(timespec="seconds"),
        "asset": agent_id,
        "category": category,
        "src_ip": ip,
        "account": account[:120],
    }


def load_cursor(path: Path) -> str | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value.get("cursor") if isinstance(value.get("cursor"), str) else None
    except (FileNotFoundError, ValueError, OSError):
        return None


def store_cursor(path: Path, cursor: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps({"cursor": cursor}), encoding="utf-8")
    os.chmod(temp, 0o600)
    temp.replace(path)


def collect(cursor: str | None, agent_id: str) -> tuple[list[dict], str | None]:
    # Initial lookback bounded to 5 minutes. Later polls resume exactly after the saved cursor.
    cmd = ["journalctl", "--output=json", "--no-pager"]
    cmd += ["--after-cursor", cursor] if cursor else ["--since", "5 minutes ago"]
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=25, check=False)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"Unable to read journald: {exc}") from exc
    if completed.returncode != 0:
        raise RuntimeError(f"journalctl failed: {completed.stderr.strip()[:350]}")
    events: list[dict] = []
    last = cursor
    for line in completed.stdout.splitlines():
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(raw, dict):
            continue
        if raw.get("__CURSOR"):
            last = str(raw["__CURSOR"])
        event = parse_entry(raw, agent_id)
        if event:
            events.append(event)
    return events, last


def send_batch(base_url: str, token: str, agent_id: str, events: list[dict], timeout=10) -> dict:
    data = json.dumps({"agent_id": agent_id, "events": events}).encode("utf-8")
    req = request.Request(
        base_url.rstrip("/") + "/api/ingest/linux", data=data, method="POST",
        headers={"Content-Type": "application/json", "X-Agent-Token": token},
    )
    # Do not allow HTTP_PROXY / HTTPS_PROXY environment settings to route local secrets.
    opener = request.build_opener(request.ProxyHandler({}))
    with opener.open(req, timeout=timeout) as resp:
        return json.load(resp)


def poll(*, base_url: str, token: str, agent_id: str, state_path: Path) -> dict:
    cursor = load_cursor(state_path)
    events, next_cursor = collect(cursor, agent_id)
    accepted, alerts = 0, 0
    # Heartbeat even when there are no authentication events.
    for offset in range(0, len(events), 100):
        outcome = send_batch(base_url, token, agent_id, events[offset:offset + 100])
        accepted += outcome["accepted"]
        alerts += outcome["alerts_created"]
    if not events:
        send_batch(base_url, token, agent_id, [])
    # If a batch fails, this point is never reached; retries are deduplicated by event_id.
    if next_cursor:
        store_cursor(state_path, next_cursor)
    return {"received": len(events), "accepted": accepted, "alerts": alerts}


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Linux journald authentication agent")
    parser.add_argument("--once", action="store_true", help="Single poll for testing")
    parser.add_argument("--interval", type=int, default=20, help="Poll interval in seconds (min 10)")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Local SOC API URL")
    parser.add_argument("--state", default=str(Path(__file__).parent / "data/linux-agent-cursor.json"))
    args = parser.parse_args()
    if args.interval < 10:
        parser.error("--interval must be >= 10")
    if args.url.rstrip("/") not in {"http://127.0.0.1:8000", "http://localhost:8000"}:
        parser.error("MVP only permits the local API at http://127.0.0.1:8000")
    token = os.getenv("SOC_INGEST_TOKEN", "")
    if len(token) < 32:
        parser.error("Set SOC_INGEST_TOKEN to a random secret of at least 32 characters")
    agent_id = socket.gethostname()[:120]
    while True:
        try:
            result = poll(base_url=args.url, token=token, agent_id=agent_id,
                          state_path=Path(args.state))
            print(f"journal poll: {result['received']} matched, {result['accepted']} new, "
                  f"{result['alerts']} alerts", flush=True)
        except (RuntimeError, error.URLError, ValueError, OSError, KeyError) as exc:
            print(f"agent warning: {exc}", file=sys.stderr, flush=True)
            if args.once:
                return 1
        if args.once:
            return 0
        try:
            time.sleep(args.interval)
        except KeyboardInterrupt:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
