# SOC Command Center v0.2 — Local Linux Live Telemetry

A **self-owned, local-first mini SOC** by Manish Verma (`djemoix`): a small Linux auth-log agent, an authenticated ingestion endpoint, deterministic correlation rules, and a FastAPI/SQLite investigation dashboard.

> **Scope:** Local Linux lab MVP only. It is not a replacement for a production SIEM or EDR. There is **no analyst authentication**, RBAC, TLS, durable central logging, integrity monitoring, or remote agent enrollment. **Run only on `127.0.0.1` and do not put sensitive company logs into this lab.**

## What is real, what is demo?

| Mode | How data arrives | What dashboard shows |
| --- | --- | --- |
| `demo` (default) | Eight intentionally synthetic examples on empty DB | Clearly marked DEMO environment |
| `live` | `linux_agent.py` reads this Linux machine's `journalctl` JSON; authenticated local API ingests normalized SSH/sudo failure metadata | **No demo seeding**; separate `data/soc-live.db`; agent connection status and real event counts; alerts appear only when detections fire |
| `manual` | No demo seeding; analysts enter test alerts | Unverified/manual events; not live telemetry |

**v0.2 supports Linux journald SSH failures and sudo authentication failures only**. SSH/sshd must be logging to journald, and the agent's account must be authorized to read those records. Windows, Wazuh, Splunk, Sysmon, EDR, network traffic and all other telemetry are **not** connected.

## Architecture

```text
Linux host's journald (read-only)
  -> linux_agent.py (poll + parse, journal cursor, no raw-log upload)
  -> POST /api/ingest/linux [X-Agent-Token, local loopback only]
  -> SQLite journal_events (normalized metadata, dedup by event_id)
  -> detection.py (rolling 5-minute windows and cooldown)
  -> alerts + cases (same FastAPI API as v0.1)
  -> dashboard (mode banner, agent health, 20-second auto-refresh)
```

Rules are for triage and require corroboration:

- **10 failed SSH authentications from one source IP to one host in 5 minutes** -> high alert, candidate MITRE ATT&CK T1110.
- **3 sudo authentication failures for the same local account/host in 5 minutes** -> medium alert.
- Each detector group has a **5-minute cooldown** to reduce repeated alerts. Duplicate journal events are ignored via unique IDs.

Raw log `MESSAGE` text is **never forwarded** to the server: the collector only transmits timestamp, Linux hostname, event category, source IP where available, local account label, and a SHA-256 event fingerprint. Normalized event metadata is retained up to 30 days; incident cases/alerts have no automatic expiry in this MVP. The collector's cursor advances only after successful delivery, so network retries are idempotent.

## Run LIVE on Ubuntu / Kali / Debian (Linux host)

Requires Python **3.11+**, `journalctl`, and permission to read the desired Linux journal entries.

**1. Clone the v0.2 branch and set up dependencies**

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip

git clone -b feature/soc-command-center-real-linux-v02 https://github.com/djemoix/djemoix.git
cd djemoix/projects/soc-command-center
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
```

**2. Generate a local-only token file** (never push it to GitHub)

```bash
umask 077
python3 - <<'PY'
from pathlib import Path
import secrets
Path('.env.local').write_text(
    "export SOC_DATA_MODE=live\n"
    "export SOC_INGEST_TOKEN='" + secrets.token_urlsafe(48) + "'\n"
)
PY
source .env.local
```

**3. Start dashboard API in Terminal A:**

```bash
cd djemoix/projects/soc-command-center   # omit this if already in project folder
source .venv/bin/activate
source .env.local
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

**4. Start journald agent in Terminal B** (open a new terminal in the same project directory):

```bash
source .venv/bin/activate
source .env.local
python linux_agent.py --once         # first dry connectivity poll
python linux_agent.py                # keep running to poll every 20 s
```

**5. Open:** <http://127.0.0.1:8000>. For status check:

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/telemetry
```

`/api/telemetry` must show an agent after the first successful poll. **0 events or 0 alerts is a legitimate result**, especially if there were no matching failed SSH/sudo authentications recently. Do not confuse an online agent with evidence of attacks. The dashboard automatically refreshes every 20 seconds when visible.

> Terminal path tip: the `cd djemoix/...` line in step 3 assumes your current directory is **the parent of the cloned `djemoix` directory**. If you stayed in the project directory from step 2, omit the `cd` line.

### If you cannot read system authentication records

Check your current visibility with `journalctl --since '10 minutes ago' --no-pager | grep -Ei 'sshd|sudo'`. On some distributions, system journals require membership in a privileged reading group (often `adm` or `systemd-journal`). Consult your distro's journal access policy and have the system administrator grant **minimum necessary read permission**; do not run the dashboard as root. The agent does **not** elevate its privileges or change log settings. It cannot collect SSH events when no SSH service is installed or messages are not in journald.

## Tests without real credential attempts

Running `python -m pytest -q` tests synthetic journal fixtures in a **temporary database**. It verifies parsers, token rejection, 5-minute correlation, deduplication, cursor retry, and incident-case workflow. This does not claim an end-to-end test against your own Linux journal until you start the agent on your PC.

Avoid creating repeated real login failures on work systems simply to test the rule. Use an **authorized isolated lab VM** if you need to validate real SSH log output. No external target IPs are required.

## Optional: keep old demo mode separate

```bash
unset SOC_DATA_MODE SOC_INGEST_TOKEN SOC_DB_PATH
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Demo mode uses `data/soc.db`, while live mode defaults to `data/soc-live.db`. Do not force them to share a `SOC_DB_PATH`.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Mode, API version and data source |
| GET | `/api/telemetry` | Agent online/offline state and normalized events in last 24h |
| POST | `/api/ingest/linux` | **Token-protected** Linux event batch, up to 100 records |
| GET | `/api/alerts`, `/api/summary` | Alerts / KPI metrics |
| POST | `/api/alerts` | Manual alerts, disabled in live mode |
| PATCH | `/api/alerts/{id}` | Update alert status |
| GET/POST | `/api/incidents` | Case read/create |
| PATCH | `/api/incidents/{id}` | Status/analyst notes |

### Constraints and hardening backlog

- Local HTTP only; a shared ingestion token authenticates agent writes, **not** dashboard viewers/analysts. Never use `--host 0.0.0.0`.
- Add login, session security, RBAC, audit logs, rate limits and HTTPS **before** remote use.
- Add loss-aware high-volume journal streaming, configurable rules, tests against multiple distro log formats, migration management, retention for cases and optional open-source collectors.
- Use machine-level OS access controls to protect `.env.local`, cursor files and the SQLite database; `.env.local`, `.venv/` and `data/` are excluded from Git.
- Review sensitive username, IP and incident details before running even on localhost. No telemetry is sent to third-party services by this application.

## Files

```text
projects/soc-command-center/
├── app.py                    # FastAPI + incident workflow + ingestion API
├── detection.py              # SSH / sudo rule correlation
├── linux_agent.py            # read-only journald collector, resume cursor
├── web/                      # HTML/CSS/JS local dashboard
├── tests/                    # API, parser, cursor and detection tests
├── requirements*.txt
└── README.md
```

**Maintainer:** Manish Verma · [GitHub `djemoix`](https://github.com/djemoix).
