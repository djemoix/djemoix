#!/usr/bin/env node
/**
 * run-daily.mjs — Master daily automation
 *
 * Kya karta hai:
 * 1. Naye job postings scan karta hai (Greenhouse/Ashby/Lever APIs)
 * 2. Naye HR emails companies.json mein add karta hai
 * 3. Sab pending companies ko email bhejta hai
 * 4. Daily report banata hai
 *
 * Usage:  node run-daily.mjs
 * Cron:   0 9 * * * cd /path/to/career-ops && node run-daily.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load .env ---
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}
loadEnv();

const LOG_FILE       = path.join(__dirname, 'email-log.json');
const COMPANIES_FILE = path.join(__dirname, 'companies.json');
const REPORT_DIR     = path.join(__dirname, 'reports');

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

// --- Step 1: Scan Greenhouse API for cybersecurity jobs in India ---
async function scanGreenhouseJobs() {
  const queries = ['security analyst', 'soc analyst', 'penetration tester', 'cybersecurity engineer'];
  const found = [];

  for (const q of queries) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/search?q=${encodeURIComponent(q)}&location=india&country_id=115`;
      const data = await fetch(url).then(r => r.json()).catch(() => null);
      if (data?.jobs) found.push(...data.jobs);
    } catch { /* skip */ }
  }
  return found;
}

// --- Step 2: Scan Ashby API ---
async function scanAshbyJobs() {
  const companies = [
    'cloudsek', 'sequretek', 'kratikal', 'securelayer7', 'qualysec'
  ];
  const found = [];
  for (const slug of companies) {
    try {
      const res = await fetch(`https://jobs.ashbyhq.com/api/non-user-graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationName: 'ApiJobBoardWithTeams',
          variables: { organizationHostedJobsPageName: slug },
          query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
            jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
              jobPostings { id title locationName applyUrl }
            }
          }`
        })
      }).then(r => r.json()).catch(() => null);
      const jobs = res?.data?.jobBoard?.jobPostings || [];
      found.push(...jobs.filter(j =>
        /secur|soc|cyber|pentest|threat|analyst/i.test(j.title)
      ).map(j => ({ ...j, company: slug })));
    } catch { /* skip */ }
  }
  return found;
}

// --- Step 3: Send emails (calls email-blast.mjs logic inline) ---
async function sendEmails() {
  const { default: nodemailer } = await import('nodemailer');

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

  if (!GMAIL_USER || !GMAIL_PASS || GMAIL_PASS === 'xxxx-xxxx-xxxx-xxxx') {
    log('⚠️  Gmail not configured — skipping email send');
    log('   Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    return { sent: 0, failed: 0 };
  }

  const companies = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8'));
  const emailLog  = fs.existsSync(LOG_FILE)
    ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
    : {};

  const pending = companies.filter(c => !emailLog[c.email]);
  const BATCH   = parseInt(process.env.BATCH_SIZE || '15', 10);
  const batch   = pending.slice(0, BATCH);

  if (batch.length === 0) {
    log('✅  No pending companies to email today');
    return { sent: 0, failed: 0 };
  }

  log(`📧  Emailing ${batch.length} companies...`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  const cvPath = path.join(__dirname, 'output', 'manish-verma-cv.html');
  const attachments = fs.existsSync(cvPath)
    ? [{ filename: 'Manish-Verma-CV.html', path: cvPath }]
    : [];

  let sent = 0, failed = 0;

  for (const company of batch) {
    const subject = `Application — ${company.role} | Manish Verma | 5+ Yrs | OSCP Pursuing`;
    const text = `Dear ${company.company} Hiring Team,

I am writing to apply for a ${company.role} position at ${company.company}.

HIGHLIGHTS:
• SOC Analyst, Researcher & Pentester — Nihon Cyber Defence, Japan (Remote) | Oct 2023–Aug 2024
  Graylog SIEM, incident triage, RCA reports, ISO 27001/NIST CSF compliance, Blue/Purple team
• Security Analyst — SSRV Filtration Pvt Ltd, Jaipur | Jan 2019–Jan 2021
  VAPT, improved security efficiency by 20%
• Cybersecurity Intern — Redynox Academy | Sep–Oct 2025
  Web app VAPT, firewall config, Wireshark, OWASP ZAP

SKILLS: Kali Linux · Metasploit · Burp Suite · OWASP ZAP · Graylog · Splunk · Nmap · Wireshark
        Nessus · Shodan · OSINT · NIST CSF · ISO 27001 · COBIT · Bash · PowerShell

CERTIFICATIONS:
• OSCP+ — Pursuing (OffSec)          • Google Cybersecurity Professional (2024)
• Jr Penetration Tester (TryHackMe)   • ISO 9001:2015 Certified Cyber Security Professional
• Ethical Hacking Essentials          • Android Bug Bounty · SQL Injection Attacks

EC-Council: Operation Deep Breach (Apr 2025) · RansomWar: Digital Hostage (Mar 2025)

Based in Jaipur, Rajasthan. Open to remote / hybrid / relocation across India.
CV attached. Available for a call anytime.

Best regards,
Manish Verma
+91-7240252131 | manishcyber82@gmail.com
linkedin.com/in/manish-verma01 | github.com/djemoix`;

    try {
      await transporter.sendMail({
        from: `"Manish Verma" <${GMAIL_USER}>`,
        to: company.email,
        subject,
        text,
        attachments
      });
      emailLog[company.email] = { company: company.company, sentAt: new Date().toISOString(), status: 'sent' };
      fs.writeFileSync(LOG_FILE, JSON.stringify(emailLog, null, 2));
      sent++;
      log(`  ✅  ${company.company} → ${company.email}`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      emailLog[company.email] = { company: company.company, sentAt: new Date().toISOString(), status: 'failed', error: err.message };
      fs.writeFileSync(LOG_FILE, JSON.stringify(emailLog, null, 2));
      log(`  ❌  ${company.company} — ${err.message}`);
    }
  }

  return { sent, failed, remaining: pending.length - batch.length };
}

// --- Step 4: Generate daily report ---
function generateReport(emailStats, newJobs) {
  const date = new Date().toISOString().slice(0, 10);
  const emailLog = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : {};
  const totalSent = Object.values(emailLog).filter(e => e.status === 'sent').length;

  const report = `# Daily Job Search Report — ${date}

## Email Summary
- Sent today: ${emailStats.sent}
- Failed today: ${emailStats.failed}
- Remaining in queue: ${emailStats.remaining ?? 0}
- **Total sent all-time: ${totalSent}**

## New Jobs Found via Portal Scan
${newJobs.length > 0
  ? newJobs.map(j => `- [${j.title}](${j.applyUrl || '#'}) — ${j.company || ''} | ${j.locationName || 'India'}`).join('\n')
  : '- No new matching jobs found today'}

## Companies Emailed Today
${Object.entries(emailLog)
  .filter(([, v]) => v.sentAt?.startsWith(date))
  .map(([email, v]) => `- ${v.company} → ${email}`)
  .join('\n') || '- None'}

---
Run again tomorrow: \`node run-daily.mjs\`
`;

  const reportPath = path.join(REPORT_DIR, `daily-${date}.md`);
  fs.writeFileSync(reportPath, report);
  log(`📊  Report saved: reports/daily-${date}.md`);
  console.log('\n' + report);
}

// --- MAIN ---
async function main() {
  console.log('\n🚀  Career-Ops Daily Runner\n' + '='.repeat(40));

  log('🔍  Scanning job portals...');
  let newJobs = [];
  try {
    const [greenhouse, ashby] = await Promise.allSettled([
      scanGreenhouseJobs(),
      scanAshbyJobs()
    ]);
    newJobs = [
      ...(greenhouse.status === 'fulfilled' ? greenhouse.value : []),
      ...(ashby.status === 'fulfilled' ? ashby.value : [])
    ];
    log(`   Found ${newJobs.length} matching job postings`);
  } catch (e) {
    log(`⚠️  Portal scan failed: ${e.message}`);
  }

  log('📬  Running email blast...');
  const emailStats = await sendEmails();

  log('📝  Generating report...');
  generateReport(emailStats, newJobs);

  log('✅  Daily run complete!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
