# Database Migration Safety & Hardening Report

**Document Version:** 1.0.0  
**Migration Path:** Forward-Only (001_initial_schema.sql → 063_secure_webhook_and_outbox_tables.sql)  
**Database:** PostgreSQL 15+ (Supabase / Postgres)

---

## 1. Migration Inventory & Ordering Analysis

| Migration Number | File Name                                             | Status            | Purpose                                                                            | RLS Status                    |
| ---------------- | ----------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| `001`            | `001_initial_schema.sql`                              | Applied           | Core accounts, profiles, contacts, messages, conversations                         | ✅ Enforced                   |
| `002`–`024`      | Feature extensions                                    | Applied           | Flows, chat media, avatars, message reactions                                      | ✅ Enforced                   |
| `028`–`030`      | Multi-tenant SaaS                                     | Applied           | Account subscriptions, plans, usage counters                                       | ✅ Enforced                   |
| `032`–`040`      | Hospital & Clinic                                     | Applied           | `hospital_doctors`, `hospital_departments`, `hospital_lab_reports`, `appointments` | ✅ Enforced                   |
| `041`–`061`      | Settings & Followups                                  | Applied           | Booking form settings, AI prompt sync, clinic follow-ups                           | ✅ Enforced                   |
| `062`            | `062_security_and_reliability_hardening.sql`          | Applied / Staged  | Creates `outbound_outbox` and `inbound_webhook_events`                             | ⚠️ Missing RLS / Revoke       |
| `062_rollback`   | `062_security_and_reliability_hardening_rollback.sql` | **REMOVED**       | Dropped tables destructively from migration sequence                               | ❌ Moved to `docs/rollbacks/` |
| `063`            | `063_secure_webhook_and_outbox_tables.sql`            | **NEW (Forward)** | Enables RLS, revokes client access, adds `account_id` & retention indexes          | ✅ Strictly Enforced          |

---

## 2. Identified Vulnerabilities in Migration 062

1. **Rollback File sitting in Migration Directory**:
   `062_security_and_reliability_hardening_rollback.sql` was located directly in `supabase/migrations/`. Standard migration tools (e.g. `supabase db push`, `db-migrate`) execute all `.sql` files in lexicographical order. The rollback file immediately ran after 062, dropping `outbound_outbox` and `inbound_webhook_events` and truncating data.
   **Remediation:** Relocate to `docs/rollbacks/062_security_and_reliability_hardening.rollback.sql` with explicit manual operational warnings.

2. **Missing Row Level Security on Queue Tables**:
   `outbound_outbox` and `inbound_webhook_events` were created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`. In Supabase, tables without RLS are exposed to anonymous and authenticated PostgREST clients by default.
   **Remediation:** In Migration 063:

   ```sql
   ALTER TABLE outbound_outbox ENABLE ROW LEVEL SECURITY;
   ALTER TABLE inbound_webhook_events ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON outbound_outbox FROM anon, authenticated;
   REVOKE ALL ON inbound_webhook_events FROM anon, authenticated;
   ```

3. **Tenant Disassociation in Inbound Events**:
   `inbound_webhook_events` lacked an `account_id` column. When Meta delivers a webhook payload, the payload initially belongs to a phone number ID before being resolved to an account.
   **Remediation:** Add nullable `account_id UUID REFERENCES accounts(id) ON DELETE CASCADE`. The webhook ingestion layer populates `account_id` as soon as the WhatsApp configuration is matched.

---

## 3. Webhook Raw Payload Retention & Sanitization Policy

### Retention Lifecycle:

1. **Receipt**: Raw JSON payload is stored with status `'received'` in `inbound_webhook_events`.
2. **Processing**: Normalization extracts contact information, message text, and attachments into `contacts` and `messages`. Status advances to `'completed'`.
3. **Retention Cap**:
   - `completed` events: Raw JSON payload is purged after **7 days**, retaining only event metadata (`event_id`, `account_id`, `status`, `created_at`, `processed_at`).
   - `dead_letter` / `failed` events: Retained for **30 days** for administrator inspection and triage in `/admin/dead-letter`.
4. **Automated Cleanup**: A daily cron job (`POST /api/cron/cleanup-webhooks`) drains expired payloads using header-authenticated `x-cron-secret`.

---

## 4. Emergency Manual Rollback Procedure

> [!WARNING]
> Rolling back migration 062 / 063 drops the idempotency event registry and outbound outbox. Any queued messages or in-flight webhooks will be lost. Ensure a full database snapshot exists before proceeding.

To manually roll back on a test environment:

```bash
# 1. Take a physical database backup
supabase db dump -f backup_pre_rollback.sql

# 2. Execute manual rollback SQL
psql "$DATABASE_URL" -f docs/rollbacks/062_security_and_reliability_hardening.rollback.sql
```
