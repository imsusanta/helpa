-- ============================================================
-- EMERGENCY MANUAL ROLLBACK FOR MIGRATION 062
--
-- Location: docs/rollbacks/062_security_and_reliability_hardening.rollback.sql
--
-- WARNING:
-- This rollback script is destructive and drops outbound_outbox
-- and inbound_webhook_events tables, which will purge queued
-- messages and in-flight webhook idempotency records.
--
-- NEVER run this automatically in CI or production migrations.
-- A full physical database backup is required before manual execution.
--
-- Manual execution:
--   psql "$DATABASE_URL" -f docs/rollbacks/062_security_and_reliability_hardening.rollback.sql
-- ============================================================

DROP INDEX IF EXISTS idx_appointments_account_date_token;
ALTER TABLE appointments DROP COLUMN IF EXISTS ticket_serial;

DROP INDEX IF EXISTS idx_inbound_webhook_events_status;
DROP TABLE IF EXISTS inbound_webhook_events;

DROP INDEX IF EXISTS idx_outbound_outbox_account_status;
DROP TABLE IF EXISTS outbound_outbox;
