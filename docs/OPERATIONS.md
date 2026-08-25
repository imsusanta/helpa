# Helpa Operational Runbook & Maintenance Guide

**System:** Helpa Healthcare CRM & WhatsApp AI (Next.js 16 + Supabase)

---

## 1. Scheduled Background Tasks (Cron Jobs)

All cron routes use `authorizeCronRequest` (`src/lib/cron/security.ts`). Auth is fail-closed: missing secrets return HTTP 503. `NODE_ENV` does not disable the check.

Secrets are accepted in `x-cron-secret` or `Authorization: Bearer`.

| Endpoint | Secrets | Scheduled in `vercel.json`? | Purpose |
| --- | --- | --- | --- |
| `POST /api/cron/reminders` | `CRON_SECRET` | No — external scheduler required | 24h and 2h appointment reminders |
| `GET /api/cron/campaigns` | `CRON_SECRET` | Yes — daily 01:00 UTC | Campaign automations, tenant-scoped |
| `GET`/`POST /api/cron/subscription-lifecycle` | `CRON_SECRET` or `AUTOMATION_CRON_SECRET` | Yes — daily 00:00 UTC | Expire stale trials |
| `POST /api/cron/cleanup-webhooks` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | No | Strip old webhook payloads / dead letters |
| `GET /api/automations/cron` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | No | Drain pending automation step executions |
| `GET /api/flows/cron` | `AUTOMATION_CRON_SECRET` or `CRON_SECRET` | No | Time out abandoned flow runs |

The WhatsApp + voice **outbox worker** is not a cron. Run `npm run worker` as a persistent 5s poller. Details: `docs/production-workers.md`.

---

## 2. Webhook Dead-Letter Queue Triage

When an inbound WhatsApp message fails normalization or hits an unrecoverable provider error, it is stored in `webhook_dead_letter`:

- Access `/admin/dead-letter` with `owner` credentials.
- Inspect the error message and retry count.
- Re-process once provider connectivity is restored.

---

## 3. Key Rotation Procedure

1. Generate a new 32-byte key: `NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
2. Set `ENCRYPTION_KEY=$NEW_KEY` (and `WHATSAPP_TOKEN_ENCRYPTION_KEY` if used).
3. Decryption fallback in `src/lib/whatsapp/encryption.ts` keeps legacy ciphertext readable while new writes use the active key.

---

## 4. Healthcare Operational Controls

### A. Audit Logging

- Administrative actions (invitations, role changes, patient deletions) write `audit_logs` rows (`account_id`, actor, action, resource).
- The structured logger redacts names, phones, and bearer tokens.

### B. Retention & Deletion

- Raw webhook payloads: stripped of PII after 7 days via `POST /api/cron/cleanup-webhooks` (must be scheduled; not in `vercel.json`).
- Dead-letter events: purged after 30 days by the same job.
- Patient deletion: soft delete then cascade.

### C. Database Backups & PITR

Use **Supabase** project backups and point-in-time recovery (enable PITR in the Supabase dashboard for production). This is not Appwrite Cloud PITR.

Disaster recovery target (operational goal): RPO depends on the Supabase plan's WAL retention; RTO is a restore of the Supabase project plus a new app deploy.

See `docs/operations/runbook-backup-restore.md`.

### D. Incident Response

1. **Meta WhatsApp outage**: inbound webhooks land in dead-letter storage; retry after connectivity returns. Outbound uses `outbound_outbox` + the 5s worker.
2. **Database failover**: follow Supabase status and PITR restore; there is no Appwrite replica failover.
3. **Security incident**: rotate `ENCRYPTION_KEY`, revoke sessions in Supabase Auth, inspect `audit_logs`.
4. **Unsigned payment webhooks**: Razorpay is rejected with 503 if `RAZORPAY_WEBHOOK_SECRET` is missing, 400 if the signature is invalid.
