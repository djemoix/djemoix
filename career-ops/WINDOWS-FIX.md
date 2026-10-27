# 🚀 WINDOWS SETUP — Super Simple (2 clicks)

## Problem Fix Guide

Teri screenshot mein 2 problem thi:
1. ❌ `cd career-ops` → folder tere laptop pe nahi hai
2. ❌ `cp` → yeh Linux command hai, Windows mein `copy` hota hai

**Solution:** Automated installer bana diya hai. Sirf download → double-click.

---

## ⚡ SETUP (3 minute, zero typing)

### Step 1 — INSTALL-WINDOWS.bat download karo

Yeh file open karo browser mein:
👉 https://github.com/djemoix/djemoix/raw/claude/install-career-ops-GGGES/career-ops/INSTALL-WINDOWS.bat

Right-click → **Save Link As** → Desktop pe save karo

### Step 2 — Double-click karo

`INSTALL-WINDOWS.bat` pe **double-click**

Yeh automatically karega:
- ✅ Git check karega
- ✅ Node.js check karega
- ✅ Repository clone karega → `C:\Users\abhis\career-ops-manish\`
- ✅ `npm install` chalayega
- ✅ `.env` file banayega
- ✅ Desktop pe **`Run-Career-Ops.bat`** shortcut banayega

**Agar Git ya Node.js nahi hai:** installer tujhe download link kholke dega automatically.

### Step 3 — Gmail Password add karo

Installer end mein pucega — **Y** dabao:
- `.env` file notepad mein khulegi
- `GMAIL_APP_PASSWORD=` ke baad apna 16-digit App Password paste karo
- Save karo (Ctrl+S)

Password kaise banayein:
1. [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. "Mail" → Generate → 16-digit code copy karo

### Step 4 — RUN!

Desktop pe `Run-Career-Ops.bat` **double-click**

Bas! 15 companies ko emails chali jaayengi.

---

## Daily Use

**Har din** desktop ke `Run-Career-Ops.bat` pe double-click. Done.

---

## Common Problems

**"git not recognized"** → Install Git: https://git-scm.com/download/win

**"node not recognized"** → Install Node.js: https://nodejs.org (LTS)

**"Permission denied Gmail"** → App Password galat hai, dobara generate karo

**"ETIMEDOUT"** → Internet check karo, firewall se Gmail block na ho
