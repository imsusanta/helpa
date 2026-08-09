-- Migration: 072_account_timezones.sql
-- Adds the clinic timezone used by reminders, quiet hours, and scheduling.
-- IANA identifiers are validated by the application because PostgreSQL's
-- timezone catalog can vary between managed environments.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

UPDATE public.accounts
SET timezone = 'UTC'
WHERE timezone IS NULL OR btrim(timezone) = '';

COMMENT ON COLUMN public.accounts.timezone IS
  'IANA timezone for clinic-local scheduling and quiet hours (for example Asia/Kolkata or America/New_York).';
