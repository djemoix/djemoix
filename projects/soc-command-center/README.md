# SOC Command Center · MVP

**Local-first security operations dashboard** for alert triage, incident cases and analyst notes. Built with **FastAPI, SQLite and dependency-free browser JavaScript**. Created for the `djemoix` GitHub portfolio.

![Status](https://img.shields.io/badge/status-MVP-1a8c98) ![Data](https://img.shields.io/badge/data-synthetic-eba841)

> **Demo / educational tool:** Seeded alerts are synthetic; this application does **not** connect to Splunk, Graylog or an EDR. It has **no authentication** and is **not safe to expose on a public network**. Run on localhost only; do not ingest confidential/production logs.

## Features

- Responsive SOC dashboard with total, active, high-priority alert and open-case counts
- Search/filter by severity, triage status, title, source, asset and source IP
- Manual alert creation, status updates (`new`, `investigating`, `resolved`, `false_positive`)
- Incident case creation linked to an alert, status updates, analyst notes
- Persistent SQLite storage, sample alerts using documentation-only IPs
- Interactive API reference via FastAPI `/docs`
- Pytest API/integration tests and GitHub Actions CI

## Quick start

Requires Python 3.11+.

```bash
cd projects/soc-command-center
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** to access the dashboard or **http://127.0.0.1:8000/docs** for the API.

First run creates `data/soc.db` and eight **synthetic** alerts. The database is local and excluded from Git.

## Run tests

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Readiness + demo mode |
| GET | `/api/summary` | Dashboard KPI counts |
| GET | `/api/alerts` | Filter alerts with `status`, `severity`, `q`, `limit` |
| POST | `/api/alerts` | Create manual alert |
| PATCH | `/api/alerts/{id}` | Change alert triage status |
| GET | `/api/incidents` | List cases with linked-alert count |
| POST | `/api/incidents` | Create incident and link available alerts |
| PATCH | `/api/incidents/{id}` | Update case status and analyst notes |

Example: 

```bash
curl -s http://127.0.0.1:8000/api/summary
curl -s 'http://127.0.0.1:8000/api/alerts?severity=high&status=new'
```

## Architecture

```
Browser (HTML / CSS / JS)
        │ same-origin REST calls
        ▼
FastAPI (`app.py`)
        │ parameterized SQL queries
        ▼
SQLite (`data/soc.db` — local and gitignored)
```

**Production roadmap:** Authentication + roles, audit trails, paginated ingestion, SIEM connectors with secure service credentials, retention policy, rate limiting, migrations, TLS, test coverage and deployment hardening. No such production capabilities are claimed in this MVP.

## Safety and data handling

- Default server command binds to `127.0.0.1`; do not use `--host 0.0.0.0` without implementing authentication and network controls.
- To start without demo alerts: set `SOC_SEED_DEMO=0` in the environment before launching.
- To change the data file: set `SOC_DB_PATH=/absolute/path/soc.db`.
- The UI escapes text from user-created records to prevent markup injection; API writes use Pydantic validation and SQLite parameters.
- Use documentation IP ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) in demos.
- For existing alert data, never paste passwords, tokens, customer data or unapproved logs.

## Project structure

```
projects/soc-command-center/
├── app.py
├── web/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/
│   └── test_app.py
├── requirements.txt
├── requirements-dev.txt
└── README.md
```

**Maintainer:** Manish Verma · [GitHub `djemoix`](https://github.com/djemoix)
