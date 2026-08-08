# Helpa Production Deployment Guide

**Product:** Helpa — Clinic WhatsApp AI Receptionist & Patient CRM  
**Stack:** Next.js 16 (App Router), Supabase (PostgreSQL 15+), Meta WhatsApp Cloud API

---

## 1. Environment Variable Architecture

| Variable Name                   | Exposure Scope            | Purpose                                        | Generation / Example                              |
| ------------------------------- | ------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public (Browser & Server) | Supabase project endpoint                      | `https://xxxx.supabase.co`                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Browser & Server) | Anonymous client API key                       | `eyJhbGciOiJIUzI1Ni...`                           |
| `NEXT_PUBLIC_APP_URL`           | Public (Browser & Server) | Canonical production origin                    | `https://helpa.yourdomain.com`                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-Only Secret**    | Admin database operations (bypasses RLS)       | `eyJhbGciOiJIUzI1Ni...` (Never expose to browser) |
| `ENCRYPTION_KEY`                | **Server-Only Secret**    | AES-256-GCM token encryption key               | 64-character (32-byte) hex string                 |
| `PDF_SIGNING_KEY`               | **Server-Only Secret**    | HMAC-SHA256 OPD ticket signing key             | 64-character (32-byte) hex string                 |
| `META_APP_SECRET`               | **Server-Only Secret**    | Meta WhatsApp webhook HMAC verification        | Meta Developer App Dashboard -> App Secret        |
| `AUTOMATION_CRON_SECRET`        | **Server-Only Secret**    | Shared header secret for cron jobs             | 32-character random string                        |
| `CRON_SECRET`                   | **Server-Only Secret**    | Shared header secret for appointment reminders | 32-character random string                        |

### Generating Cryptographic Keys

Run in terminal to generate secure 256-bit hexadecimal keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Vercel Deployment Instructions

1. **Import Repository**: Connect `imsusanta/wacrm_susanta` (branch `main` or release branch).
2. **Framework Preset**: Select `Next.js`.
3. **Build Command**: `next build` (default).
4. **Environment Variables**: Add all required variables listed above in Project Settings -> Environment Variables.
5. **Supabase Auth Redirects**: In Supabase Dashboard -> Authentication -> URL Configuration:
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs:
     - `https://your-domain.vercel.app/dashboard`
     - `https://your-domain.vercel.app/login`
     - `https://your-domain.vercel.app/join/*`
6. **Meta WhatsApp Cloud API Webhook**:
   - Callback URL: `https://your-domain.vercel.app/api/whatsapp/webhook`
   - Verify Token: Configured in clinic settings / database.
   - Webhook Subscribed Fields: `messages`.

---

## 3. Production Health Check & Verification

Once deployed, verify the public health endpoint:

```bash
curl -i https://your-domain.vercel.app/api/health
```

Expected Response:

```http
HTTP/2 200
cache-control: no-store, private
content-type: application/json

{"status":"ok","timestamp":"2026-08-08T10:00:00.000Z"}
```

---

## 4. Emergency Rollback Procedure

If a deployment needs to be rolled back on Vercel:

1. Navigate to **Deployments** in Vercel Dashboard.
2. Select the previous stable deployment and click **Promote to Production**.
3. If database changes must be reverted, consult [`docs/rollbacks/062_security_and_reliability_hardening.rollback.sql`](file:///Users/susantalohar/Documents/wacrm/docs/rollbacks/062_security_and_reliability_hardening.rollback.sql) with a verified physical database backup.
