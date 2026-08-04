-- Rollback for Migration 062: Security & Reliability Hardening

DROP INDEX IF EXISTS idx_appointments_account_date_token;
ALTER TABLE appointments DROP COLUMN IF EXISTS ticket_serial;

DROP INDEX IF EXISTS idx_inbound_webhook_events_status;
DROP TABLE IF EXISTS inbound_webhook_events;

DROP INDEX IF EXISTS idx_outbound_outbox_account_status;
DROP TABLE IF EXISTS outbound_outbox;
