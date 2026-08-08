# Helpa — WhatsApp AI Receptionist & Patient CRM for Clinics

> **Helpa** is an enterprise, multi-tenant WhatsApp AI receptionist and CRM built specifically for clinics, doctors, and healthcare service businesses. Automate 24/7 patient appointment bookings, generate cryptographically signed digital OPD slips, dispatch pathology lab reports, and manage multi-doctor consultation schedules.

<p align="center">
  <img src="./public/assets/helpa-hero.png" alt="Helpa — Clinic WhatsApp AI Receptionist" width="850" onerror="this.style.display='none'">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)
[![CI](https://github.com/imsusanta/wacrm_susanta/actions/workflows/ci.yml/badge.svg)](https://github.com/imsusanta/wacrm_susanta/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%2015%20%2B%20RLS-3ecf8e?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org)

---

## 🏥 Clinical Capabilities

- **24/7 AI Receptionist Copilot**: Resolves patient inquiries, explains doctor availability, and schedules OPD appointments automatically over WhatsApp.
- **Digital OPD Tickets with Signed QR Codes**: Generates short-lived HMAC-signed PDF appointment tickets with embedded QR codes that patients can present at the clinic reception desk.
- **Pathology & Lab Report Dispatch**: Ingests laboratory PDFs, parses test names, and dispatches authenticated download links directly to patients on WhatsApp.
- **Multi-Doctor & Department Rosters**: Schedule consultation hours, fee structures, and daily patient capacity per doctor.
- **Automated Appointment Reminders**: Scheduled cron jobs dispatch interactive WhatsApp confirmation buttons (Confirm / Reschedule / Cancel) at 24 hours and 2 hours prior to consultations.
- **Shared Clinic Inbox**: Front-desk staff and doctors can view live conversations, take over from AI, and add internal clinical notes.
- **Multi-Tenant Data Isolation**: Every hospital/clinic has isolated records enforced via PostgreSQL Row Level Security (RLS) and server-side authorization.

---

## 🔒 Security Architecture

1. **Fail-Closed Webhook Verification**: Inbound WhatsApp webhooks on `POST /api/whatsapp/webhook` enforce constant-time HMAC-SHA256 signature verification with `META_APP_SECRET`.
2. **Encrypted Credentials**: Meta Cloud API tokens and third-party keys are encrypted in PostgreSQL using AES-256-GCM authenticated encryption.
3. **Signed OPD Document Access**: Appointment slips and lab reports are protected by short-lived HMAC-SHA256 tokens bound to appointment ID and expiry timestamp.
4. **Deep PII/PHI Redaction**: The structured logger automatically scrubs patient names, medical notes, phone numbers, passwords, and bearer tokens from production telemetry.
5. **Strict No-Store Cache Policy**: Authenticated dashboard routes enforce `Cache-Control: private, no-store` to prevent public edge CDN caching of patient data.

---

## 🚀 Quick Start & Development

### 1. Clone & Install

```bash
git clone https://github.com/imsusanta/wacrm_susanta.git
cd wacrm_susanta
npm ci
```

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` and populate the required keys:

```bash
cp .env.local.example .env.local
```

### 3. Run Quality Gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

---

## 📖 Upstream Attribution

Helpa is based on the MIT-licensed [wacrm](https://github.com/ArnasDon/wacrm) project by [ArnasDon](https://github.com/ArnasDon) and includes Helpa-specific healthcare workflows, AI receptionist functionality, security hardening, product design, and operational extensions.
