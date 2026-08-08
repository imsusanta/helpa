# Helpa Route Security Matrix

**Document Version:** 1.0.0  
**Enforcement Model:** Default-Deny via `src/proxy.ts` Middleware & `src/lib/auth/account.ts`  

---

## 1. Public & Unauthenticated Endpoints

| Route Path | Method | Purpose | Protection & Rate-Limiting Policy | Security Notes |
|---|---|---|---|---|
| `/` | `GET` | Clinic AI Landing Page | Edge cached (Public), CSP enforced | No customer or patient data exposed |
| `/login` | `GET`, `POST` | User Authentication | Rate-limited by IP & Email | Redirects to `/dashboard` if authenticated |
| `/signup` | `GET`, `POST` | Clinic Account Creation | Rate-limited by IP | Scoped to new account setup |
| `/forgot-password`| `GET`, `POST` | Password Reset | Rate-limited | Supabase Auth recovery token |
| `/join/[token]` | `GET`, `POST` | Invitation Acceptance | Token validation via RPC | Token must be valid and unexpired |
| `/api/whatsapp/webhook` | `GET` | Meta Webhook Verification | Query token verification | Compares verify token against DB |
| `/api/whatsapp/webhook` | `POST` | Meta Inbound Webhook | HMAC-SHA256 fail-closed verification | Rejects unverified payloads with 401 |
| `/api/health` | `GET` | Service & Health Status | Rate-limited, Public Status | No secrets, versions, or PII exposed |
| `/public/appointments/[id]/pdf`| `GET` | Patient OPD Ticket Access | Cryptographic Token / HMAC Validation | Bound to appointment ID and expiry |
| `/privacy`, `/terms`, `/refund` | `GET` | Legal Policies | Static / Edge cached | No dynamic queries |

---

## 2. Authenticated Dashboard Pages (`src/app/(dashboard)/*`)

All dashboard pages are intercepted by `src/proxy.ts`. Unauthenticated sessions are automatically redirected to `/login`.

| Page Route | Required Role | Tenant Isolation Scope | Data Handled |
|---|---|---|---|
| `/dashboard` | `viewer` | Account-level aggregate metrics | Appointment counts, message volume |
| `/inbox` | `agent` | `account_id` scoped messages | Patient chat history, doctor notes |
| `/contacts` / `/patients` | `viewer` | `account_id` scoped contacts | Patient demographics, phone, blood group |
| `/appointments` / `/bookings` | `viewer` | `account_id` scoped appointments | Doctor appointments, queue position |
| `/doctors` / `/departments` | `agent` | `account_id` scoped clinical staff | Doctor rosters, consultation fees |
| `/lab-reports` | `agent` | `account_id` scoped pathology reports | Lab test statuses, report PDFs |
| `/settings` | `admin` | `account_id` configuration | WhatsApp Meta tokens, AI system prompt |
| `/admin` | `owner` / `super_admin` | Global administrative governance | System metrics, tenant health |

---

## 3. Authenticated API Endpoints (`src/app/api/*`)

| API Route | Method | Min Role | Account Scoping | Rate Limit | Service Role Used | Tests |
|---|---|---|---|---|---|---|
| `/api/account` | `GET`, `PATCH` | `admin` | Explicit `ctx.accountId` | Standard | No (RLS SSR) | `roles.test.ts` |
| `/api/account/onboard` | `POST` | `admin` | Explicit `ctx.accountId` | Tier 1 (10/min) | No (RLS SSR) | `e2e/auth-and-invites` |
| `/api/account/ai` | `GET`, `POST` | `admin` | Explicit `ctx.accountId` | Tier 1 (10/min) | No (RLS SSR) | `ai-response.test.ts` |
| `/api/account/invitations` | `GET`, `POST` | `admin` | Explicit `ctx.accountId` | Tier 1 (10/min) | Yes (RPC) | `invitations.test.ts` |
| `/api/account/members` | `GET` | `viewer` | Explicit `ctx.accountId` | Standard | No (RLS SSR) | `tenant-isolation.test.ts` |
| `/api/account/members/[userId]` | `PATCH`, `DELETE` | `owner` | Explicit `ctx.accountId` | Standard | Yes (Admin RPC) | `tenant-isolation.test.ts` |
| `/api/appointments/[id]/confirm`| `POST` | `agent` | Explicit `ctx.accountId` | Tier 2 (30/min) | Yes (WhatsApp send) | `clinical-workflows` |
| `/api/appointments/[id]/pdf` | `GET` | Token / `viewer`| Explicit `account_id` | Tier 2 (60/min) | Yes (PDF builder) | `signed-urls.test.ts` |
| `/api/patients/search` | `GET` | `agent` | Explicit `ctx.accountId` | Tier 2 (60/min) | Yes (Multi-join) | `tenant-isolation.test.ts` |
| `/api/patients/upload-pdf` | `POST` | `agent` | Explicit `ctx.accountId` | Tier 1 (15/min) | Yes (Storage/Send) | `clinical-workflows` |
| `/api/whatsapp/send` | `POST` | `agent` | Explicit `ctx.accountId` | Tier 2 (60/min) | Yes (Meta API) | `meta-api.test.ts` |
| `/api/whatsapp/broadcast` | `POST` | `admin` | Explicit `ctx.accountId` | Tier 1 (5/min) | Yes (Meta API) | `template-send.test.ts` |
| `/api/automations` | `GET`, `POST` | `admin` | Explicit `ctx.accountId` | Standard | No (RLS SSR) | `engine.test.ts` |
| `/api/cron/reminders` | `POST` | Secret | System-wide / Account loop | Dedicated | Yes (Cron engine) | `durable-events.test.ts` |

---

## 4. Authorization & Input Validation Guarantees

1. **No Client-Supplied Account Trust**: Every authenticated route derives `accountId` and `role` strictly from the verified session user profile (`requireRole`), completely ignoring any `account_id` submitted in request bodies or query parameters.
2. **Fail-Closed Webhook Verification**: `POST /api/whatsapp/webhook` enforces constant-time HMAC-SHA256 signature verification with `META_APP_SECRET`. Missing secrets or invalid headers fail with HTTP 401 before any database interaction occurs.
3. **No-Store Caching for Private Endpoints**: All API responses and dashboard pages enforce `Cache-Control: no-store, private` preventing public proxy caching.
