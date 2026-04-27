# Career-Ops Automation System — Manish Verma

## Ek baar karo (5 minute)

### Step 1 — Gmail App Password banao
1. [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) kholo
2. "Mail" → Generate → 16-digit code copy karo

### Step 2 — .env setup karo
```bash
cd career-ops
cp .env.example .env
```
`.env` file mein apna password daal do:
```
GMAIL_USER=manishcyber82@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop   ← yahan dalo
```

### Step 3 — Pehli baar manually run karo
```bash
node run-daily.mjs
```

### Step 4 — Daily automatic karo (optional)
```bash
bash setup-cron.sh
```
Ab har roz subah 9 baje **automatically** run hoga.

---

## System Files

| File | Kaam |
|------|------|
| `run-daily.mjs` | Master script — sab kuch run karta hai |
| `email-blast.mjs` | Sirf email send karna ho toh |
| `companies.json` | HR emails list — nayi companies yahan add karo |
| `email-log.json` | Kaun kaun ko email gaya — auto-track |
| `setup-cron.sh` | Daily automation setup |
| `.env` | Gmail password (sirf local, never commit) |
| `output/APPLY-NOW.md` | Web portal applications ke liye |
| `output/manish-verma-cv.html` | CV — browser mein kholo → Ctrl+P → PDF |

---

## Daily Commands

```bash
# Aaj ki run
node run-daily.mjs

# Sirf emails bhejo
node email-blast.mjs

# Nayi company add karo
# companies.json mein yeh format mein add karo:
# { "company": "Company Name", "email": "hr@company.com", "role": "SOC Analyst" }

# Kaun kaun ko email gaya dekho
cat email-log.json

# Aaj ki report dekho
cat reports/daily-$(date +%Y-%m-%d).md

# Cron log dekho
tail -f cron.log
```

---

## Nayi Companies Kaise Add Karein

`companies.json` mein add karo:
```json
{
  "company": "Company Name",
  "email": "hr@companyname.com",
  "role": "SOC Analyst / Security Analyst"
}
```

Phir `node email-blast.mjs` — automatically sirf naye wale ko email jaayegi.

---

## Web Portal Applications (manual, 10 min)

Yeh 7 companies ka portal hai — sirf login karke apply karna hai:
Cover letters already ready hain `output/APPLY-NOW.md` mein.

| Company | Link |
|---------|------|
| TIKAJ | https://www.tikaj.com/careers |
| AHEAD | https://jobs.lever.co/thinkahead/9f7ccf3a-a536-44b8-ac80-bff7f4ac701e |
| CloudSEK | https://job-boards.greenhouse.io/cloudsek/jobs/5774623004 |
| Kratikal | https://kratikal.zohorecruit.com/jobs/Careers/417243000010566141/Security-Analyst |
| SecureLayer7 | https://securelayer7.net/job |
| Qualysec | https://qualysec.com/career/ |
| TCS | https://www.tcs.com/careers/india/strategic-cybersecurity-hiring |

---

## Current Pipeline

- **Email companies:** 15 (companies.json)
- **Portal companies:** 7 (APPLY-NOW.md)
- **Total applications ready:** 22

Naukri.com pe bhi profile banao — 27,000+ companies ek saath CV dekhti hain!
