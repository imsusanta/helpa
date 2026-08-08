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
