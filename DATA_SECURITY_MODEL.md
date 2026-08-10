# Helpa Data Security & Privacy Model

**Document Version:** 1.0.0  
**Classification:** Healthcare-Adjacent Multi-Tenant SaaS  
**Compliance Target:** Indian Digital Personal Data Protection (DPDP) Act & Healthcare Data Best Practices

---

## 1. Data Classification Matrix

| Data Classification                    | Fields & Entities                                                                 | Storage Location                                                     | Protection Mechanisms                                                   | Access Scope                                    |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| **Protected Health Information (PHI)** | Patient Names, Phone Numbers, DOB, Gender, Blood Group, Doctor Consultation Notes | PostgreSQL (`patients`, `contacts`, `appointments`, `contact_notes`) | Row Level Security (RLS) + Normalized Indexing + Redacting Logs         | Scoped to authenticated clinic staff (`agent`+) |
| **Diagnostic & Lab Records**           | Pathology Test Results, Lab PDFs, Department Reports                              | PostgreSQL (`hospital_lab_reports`) + Private Storage                | AES-256-GCM / Signed HMAC Access URLs + Role Gating                     | Scoped to patient + authorized clinic agent     |
| **Cryptographic Secrets**              | WhatsApp Access Tokens, OpenRouter API Keys, Webhook Secrets                      | PostgreSQL (`accounts`, `whatsapp_config`) + Env                     | AES-256-GCM authenticated encryption (`src/lib/whatsapp/encryption.ts`) | Decrypted strictly in memory on backend         |
| **Operational & Telemetry Data**       | Webhook Events, Processing Latency, Message Statuses                              | PostgreSQL (`webhook_events`, `webhook_dead_letter`)                 | Redacted structured JSON logging (`src/lib/observability/logger.ts`)    | System Administrators & Diagnostic Runbooks     |

---

## 2. Multi-Tenant Isolation Architecture

```
[Incoming Request]
       │
       ▼
[Appwrite Auth Session Validation] (Extract verified user_id)
       │
       ▼
[Profile Lookup via Foreign Key Join] (Derive verified account_id and account_role)
       │
       ▼
[PostgreSQL Query Layer with RLS]
  - Every table query enforces `account_id = ctx.accountId`
  - Cross-tenant queries return 0 rows (404 Not Found)
  - Role gates (`owner` > `admin` > `agent` > `viewer`) reject unprivileged writes (403 Forbidden)
```

### Key Isolation Invariants:

1. **Tenant Scoping**: All database tables (`contacts`, `conversations`, `messages`, `appointments`, `hospital_doctors`, `hospital_departments`, `hospital_lab_reports`, `automations`) have an explicit `account_id UUID REFERENCES accounts(id) ON DELETE CASCADE`.
2. **PostgreSQL Row Level Security (RLS)**: Policies check `account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid())`.
3. **Admin Service Client Safety**: When background workers or webhooks utilize `getAdminClient()`, every single query explicitly includes `.eq('account_id', accountId)` to prevent unbounded table scans.
4. **Postgres Search Path Security**: All database functions and triggers specify `SET search_path = public, pg_temp` to eliminate search-path injection vulnerabilities.

---

## 3. Cryptographic Key Management & Storage Security

### A. Token Encryption (`ENCRYPTION_KEY`)

- WhatsApp Meta Cloud API tokens and third-party API credentials stored in `accounts` or `whatsapp_config` are encrypted using AES-256-GCM.
- Each ciphertext includes a unique 12-byte initialization vector (IV) and a 16-byte authentication tag.
- Format: `iv_hex:auth_tag_hex:ciphertext_hex`.

### B. Signed OPD Document Tokens (`PDF_SIGNING_KEY`)

- Digital appointment tickets and lab PDFs accessed via WhatsApp link use short-lived HMAC-SHA256 tokens (`verifyPdfToken`).
- The signature cryptographically binds the `appointment_id`, `account_id`, `purpose`, and `expires_at` timestamp.
- Expired, tampered, or cross-account tokens fail verification immediately with HTTP 401.

### C. Redacting Structured Logger

- The observability engine (`src/lib/observability/logger.ts`) automatically intercepts and scrubs:
  - Bearer tokens & passwords (`authorization`, `access_token`, `key`, `secret`)
  - Phone numbers (`+919876543210` → `+91XXXXXX3210`)
  - Patient names and message bodies (`[REDACTED_TEXT]`)
