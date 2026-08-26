# Helpa Production Deployment Guide

Helpa is a Next.js 16 application. Canonical data and auth are **Supabase** (PostgreSQL, Auth, Storage). Hosting is whatever runs `next start` or the Vercel/Node runtime pointed at this repo — not Appwrite Sites, Auth, Databases, or Storage.

Authoritative current docs:

- This file — env, build, deploy
- `docs/production-workers.md` — worker poller and HTTP crons
- `ROUTE_SECURITY_MATRIX.md` — public vs authenticated routes
- `docs/OPERATIONS.md` — backups and incident response
- `docs/SUPABASE_CUTOVER_SIGN_OFF.md` — cutover status

Historical files under `docs/audits/`, `docs/deployment-canonical.md`, and `docs/canonical-production-deployment.md` describe a pre-cutover Appwrite topology and are **not** current.

## Required environment variables

Copy `.env.example` / `.env.local.example` and fill real values. Production Helpa uses the hosted project `zsxhtcprjllesptvxlyq` (`https://zsxhtcprjllesptvxlyq.supabase.co`). Do not point env vars at the retired project `tmqlzsyqlprioeoowmtk`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `AUTH_PROVIDER` | Server | Must be `supabase` |
| `DATABASE_PROVIDER` | Server | Must be `supabase` |
| `MIGRATION_MODE` | Server | Must be `cutover` (rollback/shadow are rejected) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Service-role client; never `NEXT_PUBLIC_` |
| `ENCRYPTION_KEY` / `WHATSAPP_TOKEN_ENCRYPTION_KEY` | Server-only | AES-256-GCM (64 hex chars) |
| `PDF_SIGNING_KEY` | Server-only | HMAC for public appointment PDFs |
| `META_APP_SECRET` | Server-only | WhatsApp webhook HMAC; missing → fail-closed 401 |
| `RAZORPAY_WEBHOOK_SECRET` | Server-only | Razorpay HMAC; missing → fail-closed 503 |
| `REDIS_URL` | Server-only | Shared rate-limit counters (not BullMQ) |
| `CRON_SECRET` | Server-only | Cron route protection |
| `AUTOMATION_CRON_SECRET` | Server-only | Accepted by several cron routes |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical site URL |

Never expose service-role keys, encryption keys, or webhook secrets to the browser.

## Database

Apply SQL from `supabase/migrations/` with `npm run supabase:migrate` (or the Supabase CLI). Validate with `npm run supabase:validate`.

There are no Appwrite collection setup scripts in this repository.

## Build and deploy

```text
Install: npm ci
Build:   npm run build
Start:   npm start
Worker:  npm run worker   # separate long-running process
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

After deploy, confirm `/`, `/login`, and `/api/health`. Configure Vercel Cron (see `vercel.json`) **and** an external scheduler for reminder/automation/flow/cleanup routes that are not listed there.

## Redis

Set `REDIS_URL` in production so `checkRateLimit` shares counters across serverless instances. Without it, each instance uses an in-memory Map.
