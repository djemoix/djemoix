#!/usr/bin/env node
/**
 * email-blast.mjs
 * Automatically sends job application emails to companies in companies.json
 * Usage: node email-blast.mjs
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load .env manually (no dotenv dependency needed) ---
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('\n❌  .env file not found!');
    console.error('   Run: cp .env.example .env');
    console.error('   Then fill in your GMAIL_USER and GMAIL_APP_PASSWORD\n');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
}

loadEnv();

const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASS     = process.env.GMAIL_APP_PASSWORD;
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE || '15', 10);
const LOG_FILE       = path.join(__dirname, 'email-log.json');
const COMPANIES_FILE = path.join(__dirname, 'companies.json');

if (!GMAIL_USER || !GMAIL_PASS || GMAIL_PASS === 'xxxx-xxxx-xxxx-xxxx') {
  console.error('\n❌  Gmail credentials not set in .env file!');
  console.error('   Fill in GMAIL_USER and GMAIL_APP_PASSWORD\n');
  process.exit(1);
}

// --- Load companies ---
const companies = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8'));

// --- Load log (track already-emailed companies) ---
let log = {};
if (fs.existsSync(LOG_FILE)) {
  log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
}

function saveLog() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// --- Filter out already-emailed ---
const pending = companies.filter(c => !log[c.email]);

if (pending.length === 0) {
  console.log('\n✅  All companies already emailed! Add more to companies.json\n');
  process.exit(0);
}

const batch = pending.slice(0, BATCH_SIZE);

console.log(`\n📧  Sending to ${batch.length} companies (${pending.length} total pending)\n`);

// --- Nodemailer transporter ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

// --- Email builder ---
function buildEmail(company) {
  const subject = `Application — ${company.role} | Manish Verma | 5+ Years Experience | OSCP Pursuing`;

  const body = `Dear ${company.company} Hiring Team,

I am writing to apply for a ${company.role} position at ${company.company}.

ABOUT ME:
I am a cybersecurity professional with 5+ years of experience across SOC operations, incident response, penetration testing, and vulnerability management.

EXPERIENCE HIGHLIGHTS:
• SOC Analyst, Researcher & Pentester — Nihon Cyber Defence, Japan (Remote) | Oct 2023 – Aug 2024
  - Graylog SIEM monitoring, alert triage, high-priority incident escalation
  - Deep-dive incident investigation with detailed Root Cause Analysis reports
  - Developed and maintained security policies and incident response plans
  - Primary point of contact for enterprise clients; mentored Level 1 analysts
  - Applied NIST CSF, ISO 27001, COBIT in IT audits and risk assessments
  - Blue Team defense and Purple Team collaboration

• Security Analyst — SSRV Filtration Pvt Ltd, Jaipur | Jan 2019 – Jan 2021
  - VAPT engagements; improved operational security efficiency by 20%

• Cybersecurity Intern — Redynox Academy | Sep–Oct 2025
  - Web app vulnerability scanning (OWASP ZAP); firewall & WPA2/WPA3 config

TECHNICAL SKILLS:
• Penetration Testing: Kali Linux, Metasploit, Burp Suite, OWASP ZAP, Aircrack-ng, John the Ripper
• SIEM & Monitoring: Graylog, Splunk, Wireshark, Nmap, Zabbix
• Vulnerability Management: Nessus, Shodan, OSINT Framework, Threat Intelligence
• Compliance: NIST CSF, ISO/IEC 27001, COBIT, Risk Assessment
• AI Security: Claude AI (CVE research), ChatGPT (recon, payload testing)

CERTIFICATIONS:
• OSCP+ — Currently Pursuing (OffSec)
• ISO 9001:2015 Certified Cyber Security Professional
• Google Cybersecurity Professional Certificate (2024)
• Jr Penetration Tester — TryHackMe (THM-FRHVEFQTNN)
• Ethical Hacking Essentials | Android Bug Bounty | SQL Injection Attacks

ACHIEVEMENTS:
• EC-Council: Operation Deep Breach — Infiltrate & Escalate (Apr 2025)
• EC-Council: RansomWar: Digital Hostage (Mar 2025)

I am based in Jaipur, Rajasthan. Open to remote work, hybrid, or relocation across India.
My CV is attached for your reference.

I would welcome the opportunity to discuss how my background fits your team's needs.

Best regards,
Manish Verma
+91-7240252131 | manishcyber82@gmail.com
linkedin.com/in/manish-verma01 | github.com/djemoix`;

  return { subject, body };
}

// --- Send emails ---
let sent = 0;
let failed = 0;

for (const company of batch) {
  const { subject, body } = buildEmail(company);

  const cvPath = path.join(__dirname, 'output', 'manish-verma-cv.html');
  const attachments = [];

  if (fs.existsSync(cvPath)) {
    attachments.push({
      filename: 'Manish-Verma-CV.html',
      path: cvPath,
    });
  }

  try {
    await transporter.sendMail({
      from: `"Manish Verma" <${GMAIL_USER}>`,
      to: company.email,
      subject,
      text: body,
      attachments,
    });

    log[company.email] = {
      company: company.company,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };

    saveLog();
    sent++;
    console.log(`  ✅  ${company.company} → ${company.email}`);

    // 2 second delay between emails (avoid spam filters)
    await new Promise(r => setTimeout(r, 2000));

  } catch (err) {
    failed++;
    console.error(`  ❌  ${company.company} → ${company.email} — ${err.message}`);
    log[company.email] = {
      company: company.company,
      sentAt: new Date().toISOString(),
      status: 'failed',
      error: err.message,
    };
    saveLog();
  }
}

console.log(`\n📊  Done! Sent: ${sent} | Failed: ${failed} | Remaining: ${pending.length - batch.length}`);
console.log(`📝  Log saved to email-log.json\n`);

if (pending.length - batch.length > 0) {
  console.log(`💡  Run again tomorrow to send the next batch of ${Math.min(BATCH_SIZE, pending.length - batch.length)} emails.\n`);
}
