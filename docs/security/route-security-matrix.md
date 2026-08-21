# Helpa Route Security Matrix

**Enforcement model:** default-deny middleware in `src/proxy.ts` plus role
guards in `src/lib/auth/account.ts`.

---

## 1. Public and unauthenticated endpoints

| Route | Method | Purpose | Protection & rate limiting | Notes |
| --- | --- | --- | --- | --- |
| `/` | `GET` | Marketing landing page | Edge cached (public), CSP enforced | No customer or patient data |
| `/login` | `GET`, `POST` | Authentication | Rate limited by IP and email | Redirects authenticated users to `/dashboard` |
| `/signup` | `GET`, `POST` | Account creation | Rate limited by IP | Scoped to new account setup |
| `/forgot-password` | `GET`, `POST` | Password reset | Rate limited | Supabase auth recovery token |
| `/join/[token]` | `GET`, `POST` | Invitation acceptance | Token validation via RPC | Token must be valid and unexpired |
| `/api/whatsapp/webhook` | `GET` | Meta webhook verification | Query token comparison against stored value | Constant-time compare |
| `/api/whatsapp/webhook` | `POST` | Meta inbound webhook | Fail-closed HMAC-SHA256 verification | Unverified payloads rejected with 401 |
| `/api/health` | `GET` | Service health | Rate limited, public status | No secrets, versions, or PII |
| `/public/appointments/[id]/pdf` | `GET` | Patient OPD ticket | HMAC token validation | Bound to appointment ID, account, and expiry |
| `/privacy`, `/terms`, `/refund` | `GET` | Legal policies | Static / edge cached | No dynamic queries |

---

## 2. Authenticated dashboard pages (`src/app/(dashboard)/*`)

All dashboard routes pass through `src/proxy.ts`; unauthenticated sessions
redirect to `/login`.

| Page | Required role | Tenant scope | Data handled |
| --- | --- | --- | --- |
| `/dashboard` | `viewer` | Account aggregates | Appointment counts, message volume |
| `/inbox` | `staff` | `account_id` scoped messages | Patient chat history, notes |
| `/contacts`, `/patients` | `viewer` | `account_id` scoped contacts | Demographics, phone, blood group |
| `/appointments`, `/bookings` | `viewer` | `account_id` scoped appointments | Appointments, queue position |
| `/doctors`, `/departments` | `staff` | `account_id` scoped clinical staff | Rosters, consultation fees |
| `/lab-reports` | `staff` | `account_id` scoped reports | Test statuses, report PDFs |
| `/settings` | `admin` | `account_id` configuration | Meta tokens, AI system prompt |
| `/admin` | `owner` / super admin | Global governance | System metrics, tenant health |

---

## 3. Authenticated API endpoints (`src/app/api/*`)

| Route | Method | Min role | Scoping | Rate limit | Service role | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/account` | `GET`, `PATCH` | `admin` | `ctx.accountId` | Standard | No | `roles.test.ts` |
| `/api/account/onboard` | `POST` | `admin` | `ctx.accountId` | 10/min | No | `e2e/auth-and-invites` |
| `/api/account/ai` | `GET`, `POST` | `admin` | `ctx.accountId` | 10/min | No | `ai-response.test.ts` |
| `/api/account/invitations` | `GET`, `POST` | `admin` | `ctx.accountId` | 10/min | Yes (RPC) | `invitations.test.ts` |
| `/api/account/members` | `GET` | `viewer` | `ctx.accountId` | Standard | No | `tenant-isolation.test.ts` |
| `/api/account/members/[userId]` | `PATCH`, `DELETE` | `owner` | `ctx.accountId` | Standard | Yes (admin RPC) | `tenant-isolation.test.ts` |
| `/api/appointments/[id]/confirm` | `POST` | `staff` | `ctx.accountId` | 30/min | Yes (send) | `clinical-workflows` |
| `/api/appointments/[id]/pdf` | `GET` | Token / `viewer` | Explicit `account_id` | 60/min | Yes (PDF builder) | `signed-urls.test.ts` |
| `/api/patients/search` | `GET` | `staff` | `ctx.accountId` | 60/min | Yes (multi-join) | `tenant-isolation.test.ts` |
| `/api/patients/upload-pdf` | `POST` | `staff` | `ctx.accountId` | 15/min | Yes (storage/send) | `clinical-workflows` |
| `/api/whatsapp/send` | `POST` | `staff` | `ctx.accountId` | 60/min | Yes (Meta API) | `meta-api.test.ts` |
| `/api/whatsapp/broadcast` | `POST` | `admin` | `ctx.accountId` | 5/min | Yes (Meta API) | `template-send.test.ts` |
| `/api/automations` | `GET`, `POST` | `admin` | `ctx.accountId` | Standard | No | `engine.test.ts` |
| `/api/cron/reminders` | `POST` | Shared secret | System-wide account loop | Dedicated | Yes | `durable-events.test.ts` |

---

## 4. Authorization guarantees

1. **No client-supplied account trust.** Every authenticated route derives
   `accountId` and `role` from the verified session profile via `requireRole`,
   ignoring any `account_id` in the request body or query string.
2. **Fail-closed webhook verification.** `POST /api/whatsapp/webhook` performs
   constant-time HMAC-SHA256 verification before touching the database. Missing
   secrets or invalid headers return 401.
3. **No-store caching on private surfaces.** All API responses and
   authenticated pages set `Cache-Control: private, no-store` so no shared
   proxy can retain tenant data.
4. **Standardized error envelopes.** Routes return sanitized errors through
   `toErrorResponse()`; raw exception messages, table names, and stack traces
   are never returned to clients.
