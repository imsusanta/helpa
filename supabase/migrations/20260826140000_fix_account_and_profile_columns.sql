-- Migration: 20260826140000_fix_account_and_profile_columns.sql
-- Purpose: Add missing default_currency, smart_reminders_config, booking_form_config to accounts,
--          and avatar_url, beta_features to profiles.

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS smart_reminders_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_form_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS beta_features TEXT[] DEFAULT '{}'::text[];

COMMIT;
