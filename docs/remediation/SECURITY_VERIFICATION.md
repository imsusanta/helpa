# Helpa Security & Multi-Tenant Isolation Verification

**Document Version:** 1.0.0  
**Verification Standard:** Strict Healthcare Multi-Tenancy & Zero-Defect Authorization

---

## 1. Reconciliation of Security PR #8 vs Current Main

| Security PR #8 Item                     | Status on Main     | Reconciliation / Remediation Action                                                                                           |
| --------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `/api/mcp` authentication & kill switch | Stale / Superseded | Removed stale unauthenticated `/api/mcp` endpoints; replaced with strict default-deny proxy middleware                        |
| Fail-Closed HMAC Webhook Verification   | Present on Main    | Verified: Rejects missing secret (`401`), missing signature (`401`), tampered body (`401`), and invalid hex length (`401`)    |
| Signed OPD Document URLs                | Present on Main    | Verified: Short-lived HMAC-SHA256 tokens bound to appointment ID, account ID, and expiry timestamp                            |
| Multi-Tenant API Route Scoping          | Present on Main    | Verified: All API routes derive `accountId` strictly from authenticated Supabase profile via `requireRole`                    |
| Webhook Idempotency Registry            | Present on Main    | Hardened: Added forward migration 063 with RLS and revoked client access on `inbound_webhook_events`                          |
| Typed Admin Client                      | Missing / Partial  | Hardened: Updated `src/lib/supabase/typed-admin.ts` to strictly return `SupabaseClient<Database>` and prevent browser leakage |
| Deep PII/PHI Logger Redaction           | Missing / Partial  | Hardened: Enhanced `src/lib/observability/logger.ts` to redact recursive patient data, notes, and authorization headers       |

---

## 2. Service-Role Usage Inventory & Scoping Audit

Every file utilizing the Supabase service role client (`getAdminClient()` or `supabaseAdmin()`) was audited to verify that queries are explicitly partitioned by `account_id`:

| Server-Side File                                       | Service-Role Operation     | Tenant Account Scoping Verification                                                       |
| ------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/api/whatsapp/webhook/contact-service.ts`      | Inbound Contact Upsert     | `db.from('contacts').insert({ account_id: accountId, ... })`                              |
| `src/app/api/whatsapp/webhook/conversation-service.ts` | Conversation Sync          | `.eq('account_id', accountId)` on all conversation lookups                                |
| `src/app/api/whatsapp/webhook/process-message.ts`      | Message Ingestion          | Scoped to resolved conversation belonging strictly to `accountId`                         |
| `src/app/api/appointments/[id]/pdf/route.ts`           | OPD Ticket PDF Generation  | Checks HMAC token against `appt.account_id` or verifies user profile `account_id` matches |
| `src/app/api/patients/upload-pdf/route.ts`             | Pathology Lab PDF Dispatch | `.eq('account_id', accountId)` on all contact and report insertions                       |
| `src/app/api/patients/search/route.ts`                 | Patient Search Index       | `.eq('account_id', ctx.accountId)` strictly enforced on contact query                     |
| `src/lib/whatsapp/durable-events.ts`                   | Webhook Idempotency Check  | Scoped to unique `event_id` and optional `account_id`                                     |

---

## 3. Cryptographic Token & Webhook Verification Invariants

1. **Webhook Signature Invariant**:
   - `verifyMetaWebhookSignature(rawBody, signatureHeader)` computes HMAC-SHA256 using `META_APP_SECRET`.
   - Uses `crypto.timingSafeEqual` to prevent timing attacks.
   - If `META_APP_SECRET` is unset, signature length mismatches, or computed hash diverges, the request immediately terminates with HTTP 401.
2. **OPD Ticket Token Invariant**:
   - `generatePdfToken(appointmentId, accountId, expiresInSeconds)` computes HMAC-SHA256 signature using `PDF_SIGNING_KEY`.
   - `verifyPdfToken(token, appointmentId)` decodes base64 payload, checks expiration timestamp (`expiresAt < now`), and verifies HMAC in constant time.
   - Accessing a valid token generated for Appointment A on Appointment B fails with HTTP 401.
