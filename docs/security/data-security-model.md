# Helpa Data Security & Privacy Model

**Classification:** healthcare-adjacent multi-tenant SaaS
**Compliance target:** India DPDP Act and healthcare data best practices
(self-attested — see [threat-model.md](./threat-model.md#compliance-status))

---

## 1. Data classification matrix

| Classification | Fields & entities | Storage | Protection | Access scope |
| --- | --- | --- | --- | --- |
| **Protected health information (PHI)** | Patient names, phone numbers, DOB, gender, blood group, consultation notes | PostgreSQL (`patients`, `contacts`, `appointments`, `contact_notes`) | RLS + normalized indexing + redacting logger | Authenticated clinic staff (`staff`+) |
| **Diagnostic & lab records** | Pathology results, lab PDFs, department reports | PostgreSQL (`hospital_lab_reports`) + private storage | AES-256-GCM at rest, HMAC-signed access URLs, role gating | Patient plus authorized clinic staff |
| **Cryptographic secrets** | WhatsApp access tokens, AI API keys, webhook secrets | PostgreSQL (`accounts`, `whatsapp_config`) and environment | AES-256-GCM authenticated encryption (`src/lib/whatsapp/encryption.ts`) | Decrypted in backend memory only |
| **Operational telemetry** | Webhook events, processing latency, message status | PostgreSQL (`webhook_events`, `webhook_dead_letter`) | Redacted structured JSON logging (`src/lib/observability/logger.ts`) | System administrators and runbooks |

---

## 2. Multi-tenant isolation

```
[Incoming request]
       ▼
[Supabase session validation]  → extract verified user_id
       ▼
[Membership lookup]            → derive verified account_id and role
       ▼
[PostgreSQL query layer + RLS]
  • every query enforces account_id = ctx.accountId
  • cross-tenant reads return 0 rows (404 Not Found)
  • role gates (owner > admin > staff > viewer) reject unprivileged writes (403)
```

### Isolation invariants

1. **Explicit tenant column.** Every tenant-scoped table carries
   `account_id UUID REFERENCES accounts(id) ON DELETE CASCADE`.
2. **Row Level Security.** Policies check
   `account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())`.
3. **Service-role safety.** Background workers and webhooks using an admin
   client still pass `.eq('account_id', accountId)` on every query, so a bug
   cannot produce an unbounded cross-tenant scan.
4. **Search-path hardening.** All database functions and triggers set
   `SET search_path = public, pg_temp` to eliminate search-path injection.
5. **No client-supplied tenant trust.** `account_id` is always derived from the
   verified session, never from a request body or query parameter.

---

## 3. Key management

### Token encryption (`ENCRYPTION_KEY`)

Meta Cloud API tokens and third-party credentials stored in `accounts` or
`whatsapp_config` are encrypted with AES-256-GCM. Each ciphertext carries a
unique 12-byte IV and a 16-byte authentication tag, serialized as
`iv_hex:auth_tag_hex:ciphertext_hex`.

### Signed document tokens (`PDF_SIGNING_KEY`)

OPD tickets and lab PDFs shared over WhatsApp use short-lived HMAC-SHA256
tokens (`verifyPdfToken`). The signature binds `appointment_id`, `account_id`,
`purpose`, and `expires_at`. Expired, tampered, or cross-account tokens fail
verification with HTTP 401 before any data access.

### Redacting logger

`src/lib/observability/logger.ts` recursively scrubs:

- Bearer tokens, passwords, and secret-like keys
  (`authorization`, `access_token`, `key`, `secret`)
- Phone numbers (`+919876543210` → `+91XXXXXX3210`)
- Patient names and message bodies (`[REDACTED_TEXT]`)

---

## 4. Data subject operations

| Operation | Mechanism |
| --- | --- |
| Export | Account-scoped export endpoints, rate limited and role gated |
| Deletion | `ON DELETE CASCADE` from `accounts` removes all tenant rows |
| Retention | Webhook events and dead-letter rows pruned on a scheduled job |
| Audit | Mutations recorded in `audit_logs` with actor, account, and timestamp |
