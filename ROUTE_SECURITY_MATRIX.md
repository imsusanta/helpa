# Helpa Route Security Matrix

**Document Version:** 1.1.0
**Enforcement Model:** Default-deny via `src/proxy.ts` and `src/lib/auth/account.ts` (`requireRole`). Roles: `viewer` < `agent` < `admin` < `owner`.

This matrix describes the code as it exists today. Historical audit notes under `docs/audits/` are snapshots and must not be treated as current policy.

---

## 1. Public & Unauthenticated Endpoints

Allowed by `isPublicRoute()` in `src/proxy.ts`. Everything else requires a session.

| Route Path | Method | Purpose | Protection | Security Notes |
| --- | --- | --- | --- | --- |
| `/` | `GET` | Landing page | Edge cached, CSP | No tenant data |
| `/login`, `/signup`, `/forgot-password` | `GET`, `POST` | Auth UI | Rate-limited at `/api/auth/*` | Password recovery is **Supabase Auth**, not Appwrite |
| `/join/[token]` | `GET`, `POST` | Invitation acceptance | Token validation | Token must be valid and unexpired |
| `/api/auth/login`, `/signup`, `/logout`, `/reset-password`, `/me` | mixed | Auth API | Per-IP rate limit (`RATE_LIMITS.auth`, 10/min) | Session cookies via `@supabase/ssr` |
| `/api/whatsapp/webhook` | `GET` | Meta webhook verification | Query token vs stored config | |
| `/api/whatsapp/webhook` | `POST` | Meta inbound webhook | HMAC-SHA256, **fail-closed** if `META_APP_SECRET` missing | 401 before DB work |
| `/api/webhooks/*` | `POST` | Provider webhooks (Razorpay, Calendly, voice) | Provider-specific signatures | Razorpay returns **503** if `RAZORPAY_WEBHOOK_SECRET` is unset; never fail-open |
| `/api/public/*` | mixed | Public booking / lead forms | Token + IP rate limit (5/min) | Prefix is on the proxy allowlist; handlers still validate the form token |
| `/api/health` | `GET` | Liveness | Public | No secrets or PII |
| `/api/appointments/[id]/pdf` | `GET` | Patient OPD ticket | HMAC token **or** authenticated `viewer` | Bound to appointment id, account, expiry |
| `/privacy`, `/terms`, `/refund` | `GET` | Legal | Static | |

Cron routes are **not** public. They require `x-cron-secret` or `Authorization: Bearer` matching a configured secret. Missing secrets return **503**, never 200.

---

## 2. Authenticated Dashboard Pages (`src/app/(dashboard)/*`)

`src/proxy.ts` redirects unauthenticated sessions to `/login`. Page-level role checks still apply inside layouts/pages; API mutations use `requireRole`.

| Page Route | Typical Min Role | Tenant Scope | Data |
| --- | --- | --- | --- |
| `/dashboard` | `viewer` | Account aggregates | Appointment counts, message volume |
| `/inbox` | `agent` | `account_id` messages | Chat history |
| `/contacts` / `/patients` | `viewer` | `account_id` contacts | Demographics |
| `/appointments` | `viewer` | `account_id` appointments | Bookings |
| `/settings` | `admin` | Account configuration | WhatsApp tokens, AI prompt |
| `/admin` | `owner` / super-admin | Platform | Metrics, tenant health |

---

## 3. Authenticated API Endpoints (selected, verified in code)

`accountId` is **always** taken from the session (`requireRole` / `getCurrentAccount`). Request-body `accountId` is ignored.

| API Route | Method | Min Role | Account Scoping | Rate Limit | Notes / Tests |
| --- | --- | --- | --- | --- | --- |
| `/api/account` | `GET`, `PATCH` | `admin` | `ctx.accountId` | adminAction 30/min | |
| `/api/account/ai` | `GET`, `POST` | `admin` | `ctx.accountId` | | |
| `/api/account/invitations` | `GET`, `POST` | `admin` | `ctx.accountId` | | |
| `/api/account/members/[userId]` | `PATCH`, `DELETE` | `admin` | RPC + session | | Owner cannot be demoted via this path |
| `/api/appointments/[id]/confirm` | `POST` | `agent` | `.eq('account_id', ctx.accountId)` before load/send | | **IDOR closed.** Test: `confirm/route.test.ts` |
| `/api/leads/[id]/handoff` | `POST` | `agent` | Session `accountId` / `userId` only | | Body `accountId` ignored. Test: `handoff/route.test.ts` |
| `/api/whatsapp/send` | `POST` | `agent` | `ctx.accountId` | send 60/min | Redis-backed when `REDIS_URL` is set |
| `/api/whatsapp/broadcast` | `POST` | `admin` | `ctx.accountId` | broadcast 5/min | |
| `/api/automations` | `GET` / `POST` | `viewer` / `agent` | `ctx.accountId` | | |
| `/api/automations/engine` | `POST` | `agent` | Session account only | | Manual trigger; viewers cannot fire |
| `/api/patients/search` | `GET` | `agent` | `ctx.accountId` | | |
| `/api/patients/upload-pdf` | `POST` | `agent` | `ctx.accountId` | | |

---

## 4. Scheduled / Cron Endpoints

All use `authorizeCronRequest` in `src/lib/cron/security.ts` (constant-time compare, fail-closed, `NODE_ENV` does not relax the check). Campaign queries are tenant-scoped with `account_id`.

| Endpoint | Method | Secrets accepted | Vercel Cron (`vercel.json`) | Purpose |
| --- | --- | --- | --- | --- |
| `/api/cron/reminders` | `POST` | `CRON_SECRET` | **Not scheduled in vercel.json** — invoke from an external scheduler | 24h / 2h appointment reminders |
| `/api/cron/campaigns` | `GET` | `CRON_SECRET` | Daily `0 1 * * *` | Campaign automations; audience/contact/conversation queries filtered by `account_id` |
| `/api/cron/subscription-lifecycle` | `GET`/`POST` | `CRON_SECRET` or `AUTOMATION_CRON_SECRET` | Daily `0 0 * * *` | Expire stale trials |
| `/api/cron/cleanup-webhooks` | `POST` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | **Not in vercel.json** | Strip old webhook payloads |
| `/api/automations/cron` | `GET` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | **Not in vercel.json** | Drain pending automation steps |
| `/api/flows/cron` | `GET` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | **Not in vercel.json** | Time out abandoned flow runs |

---

## 5. Authorization & Input Validation Guarantees

1. **No client-supplied account trust.** Session profile only. Handoff previously accepted body `accountId`; it no longer does.
2. **Fail-closed webhook verification.** Meta and Razorpay reject missing secrets (401 / 503) instead of processing unsigned payloads.
3. **Fail-closed cron.** Unconfigured secrets → 503. Non-production environments are not exempt.
4. **No-store caching** on private API responses (`Cache-Control: private, no-store`).
5. **Shared rate limits.** `checkRateLimit` uses Redis `INCR`+`PEXPIRE` when `REDIS_URL` is set; otherwise an in-process Map (single-node only).
6. **Database is Supabase PostgreSQL.** There is no Appwrite Auth, Database, or Storage runtime. Compat facades live at `@/lib/db/server` and `@/lib/db/client`.
