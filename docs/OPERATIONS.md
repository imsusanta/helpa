# Helpa Operational Runbook & Maintenance Guide

**System:** Helpa Healthcare CRM & WhatsApp AI Infrastructure

---

## 1. Scheduled Background Tasks (Cron Jobs)

All cron routes enforce header authentication via `x-cron-secret` matching `AUTOMATION_CRON_SECRET` or `CRON_SECRET`.

| Schedule           | Endpoint                          | Header Requirement                       | Purpose                                                                                  |
| ------------------ | --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Every 15 min       | `POST /api/cron/reminders`        | `x-cron-secret: $CRON_SECRET`            | Dispatches 24h and 2h appointment reminders with interactive confirmation buttons.       |
| Every 1 min        | `GET /api/automations/cron`       | `x-cron-secret: $AUTOMATION_CRON_SECRET` | Drains pending automation step executions.                                               |
| Daily at 02:00 UTC | `POST /api/cron/cleanup-webhooks` | `x-cron-secret: $AUTOMATION_CRON_SECRET` | Sanitizes completed webhook payloads (>7 days) and purges dead-letter events (>30 days). |

---

## 2. Webhook Dead-Letter Queue Triage

When an inbound WhatsApp message fails normalization or encountering unrecoverable provider exceptions, it is stored in `webhook_dead_letter`:

- Access `/admin/dead-letter` with `owner` credentials.
- Inspect the error message and retry count.
- Click **Re-process Event** to replay the webhook once provider connectivity is restored.

---

## 3. Key Rotation Procedure

To rotate cryptographic encryption keys without interrupting live clinic operations:

1. Generate new 32-byte key: `NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
2. Set `ENCRYPTION_KEY=$NEW_KEY` in environment variables.
3. Decryption fallback in `src/lib/whatsapp/encryption.ts` automatically maintains legacy decrypt capability while re-encrypting modified credentials using the primary active key.

---

## 4. Healthcare Operational Controls

### A. Audit Logging Standards

- All administrative actions (user invitations, role changes, patient record deletions) produce structured JSON log entries.
- Logs include `timestamp`, `account_id`, `user_id`, `action`, `resource_id`, and `ip_address`.
- Structural logger automatically redacts patient names, phone numbers, and bearer tokens before log emission.

### B. Retention & Deletion Policies

- **Raw Webhook Payloads**: Stripped of PII after 7 days via `POST /api/cron/cleanup-webhooks`.
- **Dead-Letter Queue Events**: Hard purged after 30 days.
- **Patient Deletion Requests**: Executed via soft delete followed by hard cascade deletion on accounts, appointments, and lab report linkages.

### C. Database Backups & Point-in-Time Recovery (PITR)

- Supabase Automated Daily Backups enabled with 30-day point-in-time recovery (PITR) WAL archiving.
- Disaster recovery target: RPO < 5 minutes, RTO < 1 hour.

### D. Incident Response Protocol

1. **Meta WhatsApp API Service Outage**: Incoming webhooks fail over to dead-letter storage (`webhook_dead_letter`). System retries automatically via exponentially backed-off cron workers.
2. **Database Failover**: Supabase auto-failover switches to standby replica within 60 seconds without data loss.
3. **Security Incident Response**: Immediately rotate `ENCRYPTION_KEY`, revoke affected user session JWTs, and inspect audit logs.
