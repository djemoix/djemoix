#!/usr/bin/env node
/**
 * server.mjs — Career-Ops Local Dashboard
 *
 * Starts a web dashboard at http://localhost:3000
 * Features:
 *   - View all companies and their email status
 *   - Add/remove companies
 *   - Send emails with one click
 *   - Track delivered/bounced/pending
 *
 * Usage:  node server.mjs
 * Then open: http://localhost:3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT             = process.env.PORT || 3000;
const COMPANIES_FILE   = path.join(__dirname, 'companies.json');
const LOG_FILE         = path.join(__dirname, 'email-log.json');
const CV_FILE          = path.join(__dirname, 'output', 'manish-verma-cv.html');

// --- Helpers ---
function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

// --- Dashboard HTML ---
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Career-Ops Dashboard — Manish Verma</title>
<style>
  :root {
    --primary: hsl(187, 74%, 32%);
    --accent: hsl(270, 70%, 45%);
    --bg: #f5f7fa;
    --card: #fff;
    --text: #1a1a2e;
    --muted: #777;
    --success: #16a34a;
    --danger: #dc2626;
    --warn: #d97706;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px;
    line-height: 1.5;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  header {
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white;
    padding: 32px;
    border-radius: 12px;
    margin-bottom: 24px;
  }
  header h1 { font-size: 28px; margin-bottom: 4px; }
  header p { opacity: 0.9; font-size: 14px; }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: var(--card);
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .stat-value { font-size: 32px; font-weight: 700; color: var(--primary); }
  .stat-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .stat-card.success .stat-value { color: var(--success); }
  .stat-card.danger .stat-value { color: var(--danger); }
  .stat-card.warn .stat-value { color: var(--warn); }

  .section {
    background: var(--card);
    padding: 24px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--primary);
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.sm { padding: 6px 12px; font-size: 12px; }
  .btn.danger { background: var(--danger); }
  .btn.accent { background: var(--accent); }
  .btn.success { background: var(--success); }

  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background: #fafafa; font-weight: 600; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  tr:hover { background: #fafafa; }

  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
  .badge.pending { background: #fef3c7; color: #92400e; }
  .badge.sent { background: #d1fae5; color: #065f46; }
  .badge.bounced { background: #fee2e2; color: #991b1b; }
  .badge.replied { background: #dbeafe; color: #1e40af; }

  form { display: grid; grid-template-columns: 2fr 2fr 2fr auto; gap: 10px; margin-bottom: 16px; }
  input {
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }

  .empty { text-align: center; padding: 40px; color: var(--muted); }
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--text); color: white;
    padding: 14px 20px; border-radius: 8px;
    font-size: 14px; opacity: 0; transition: opacity 0.3s;
    z-index: 1000;
  }
  .toast.show { opacity: 1; }
  .toast.error { background: var(--danger); }
  .toast.success { background: var(--success); }

  @media (max-width: 640px) {
    body { padding: 12px; }
    form { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    header { padding: 20px; }
    header h1 { font-size: 22px; }
  }
</style>
</head>
<body>

<div class="container">

  <header>
    <h1>🎯 Career-Ops Dashboard</h1>
    <p>Manish Verma · Cybersecurity Job Pipeline · <span id="date"></span></p>
  </header>

  <div class="stats" id="stats"></div>

  <div class="section">
    <div class="section-title">
      <span>📧 Companies</span>
      <button class="btn success" onclick="sendPending()" id="sendBtn">Send to Pending</button>
    </div>

    <form onsubmit="addCompany(event)">
      <input id="newCompany" placeholder="Company Name" required>
      <input id="newEmail" type="email" placeholder="hr@company.com" required>
      <input id="newRole" placeholder="SOC Analyst" required>
      <button class="btn" type="submit">+ Add</button>
    </form>

    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Sent At</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="companiesTable"></tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">📊 Email Log</div>
    <div id="logContent"></div>
  </div>

  <div class="section">
    <div class="section-title">🔗 Quick Links</div>
    <p style="margin-bottom:12px;">
      <a href="/cv" target="_blank" style="color:var(--primary);">📄 View CV</a> ·
      <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--primary);">🔑 Gmail App Password</a> ·
      <a href="https://mail.google.com" target="_blank" style="color:var(--primary);">📨 Check Gmail</a>
    </p>
  </div>

</div>

<div class="toast" id="toast"></div>

<script>
  document.getElementById('date').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  function toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast ' + type, 3000);
  }

  async function loadData() {
    const [companies, log] = await Promise.all([
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/log').then(r => r.json())
    ]);

    // Stats
    const total = companies.length;
    const sent = Object.values(log).filter(e => e.status === 'sent').length;
    const bounced = Object.values(log).filter(e => e.status === 'bounced').length;
    const pending = companies.filter(c => !log[c.email]).length;

    document.getElementById('stats').innerHTML = \`
      <div class="stat-card"><div class="stat-value">\${total}</div><div class="stat-label">Total Companies</div></div>
      <div class="stat-card success"><div class="stat-value">\${sent}</div><div class="stat-label">Delivered</div></div>
      <div class="stat-card danger"><div class="stat-value">\${bounced}</div><div class="stat-label">Bounced</div></div>
      <div class="stat-card warn"><div class="stat-value">\${pending}</div><div class="stat-label">Pending</div></div>
    \`;

    // Companies table
    const tbody = document.getElementById('companiesTable');
    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No companies yet. Add one above.</td></tr>';
    } else {
      tbody.innerHTML = companies.map(c => {
        const entry = log[c.email];
        const status = entry?.status || 'pending';
        const sentAt = entry?.sentAt ? new Date(entry.sentAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        return \`
          <tr>
            <td><strong>\${c.company}</strong></td>
            <td>\${c.email}</td>
            <td>\${c.role}</td>
            <td><span class="badge \${status}">\${status}</span></td>
            <td style="color:var(--muted);font-size:12px;">\${sentAt}</td>
            <td><button class="btn sm danger" onclick="removeCompany('\${c.email}')">Remove</button></td>
          </tr>
        \`;
      }).join('');
    }

    // Email log
    const logContent = document.getElementById('logContent');
    const entries = Object.entries(log).sort((a, b) =>
      new Date(b[1].sentAt || 0) - new Date(a[1].sentAt || 0)
    );
    if (entries.length === 0) {
      logContent.innerHTML = '<p class="empty">No emails sent yet. Add companies and click "Send to Pending".</p>';
    } else {
      logContent.innerHTML = \`
        <table>
          <thead><tr><th>Company</th><th>Email</th><th>Status</th><th>When</th><th>Details</th></tr></thead>
          <tbody>
            \${entries.map(([email, e]) => \`
              <tr>
                <td><strong>\${e.company || '—'}</strong></td>
                <td>\${email}</td>
                <td><span class="badge \${e.status}">\${e.status}</span></td>
                <td style="color:var(--muted);font-size:12px;">\${e.sentAt ? new Date(e.sentAt).toLocaleString('en-IN') : '—'}</td>
                <td style="color:var(--muted);font-size:12px;">\${e.error || e.bounceReason || '—'}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
    }
  }

  async function addCompany(e) {
    e.preventDefault();
    const company = document.getElementById('newCompany').value;
    const email = document.getElementById('newEmail').value;
    const role = document.getElementById('newRole').value;

    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, email, role })
    });

    if (res.ok) {
      toast('✅ Added ' + company, 'success');
      document.getElementById('newCompany').value = '';
      document.getElementById('newEmail').value = '';
      document.getElementById('newRole').value = '';
      loadData();
    } else {
      toast('❌ Failed to add', 'error');
    }
  }

  async function removeCompany(email) {
    if (!confirm('Remove this company?')) return;
    const res = await fetch('/api/companies/' + encodeURIComponent(email), { method: 'DELETE' });
    if (res.ok) { toast('🗑 Removed', 'success'); loadData(); }
  }

  async function sendPending() {
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    toast('📤 Sending emails...', '');

    try {
      const res = await fetch('/api/send', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast(\`✅ Sent to \${data.sent} companies\`, 'success');
        loadData();
      } else {
        toast('❌ ' + (data.error || 'Send failed'), 'error');
      }
    } catch (e) {
      toast('❌ ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send to Pending';
    }
  }

  loadData();
  setInterval(loadData, 10000);
</script>
</body>
</html>`;

// --- Server ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Dashboard
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  // CV
  if (url.pathname === '/cv' && req.method === 'GET') {
    try {
      const cv = fs.readFileSync(CV_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cv);
    } catch {
      res.writeHead(404);
      return res.end('CV not found');
    }
  }

  // API: list companies
  if (url.pathname === '/api/companies' && req.method === 'GET') {
    return json(res, readJSON(COMPANIES_FILE, []));
  }

  // API: email log
  if (url.pathname === '/api/log' && req.method === 'GET') {
    return json(res, readJSON(LOG_FILE, {}));
  }

  // API: add company
  if (url.pathname === '/api/companies' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.company || !body.email || !body.role) {
      return json(res, { error: 'Missing fields' }, 400);
    }
    const list = readJSON(COMPANIES_FILE, []);
    if (list.find(c => c.email === body.email)) {
      return json(res, { error: 'Email already exists' }, 409);
    }
    list.push({ company: body.company, email: body.email, role: body.role });
    writeJSON(COMPANIES_FILE, list);
    return json(res, { ok: true });
  }

  // API: delete company
  if (url.pathname.startsWith('/api/companies/') && req.method === 'DELETE') {
    const email = decodeURIComponent(url.pathname.slice('/api/companies/'.length));
    const list = readJSON(COMPANIES_FILE, []).filter(c => c.email !== email);
    writeJSON(COMPANIES_FILE, list);
    return json(res, { ok: true });
  }

  // API: send pending emails
  if (url.pathname === '/api/send' && req.method === 'POST') {
    try {
      const { stdout } = await execAsync('node email-blast.mjs', { cwd: __dirname, timeout: 120000 });
      const log = readJSON(LOG_FILE, {});
      const sent = Object.values(log).filter(e => e.sentAt?.startsWith(new Date().toISOString().slice(0, 10))).length;
      return json(res, { ok: true, sent, output: stdout });
    } catch (e) {
      return json(res, { ok: false, error: e.message }, 500);
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🎯 Career-Ops Dashboard');
  console.log('  ================================');
  console.log('  Running at: \x1b[36mhttp://localhost:' + PORT + '\x1b[0m');
  console.log('  CV preview: \x1b[36mhttp://localhost:' + PORT + '/cv\x1b[0m');
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
