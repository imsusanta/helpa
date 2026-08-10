-- ============================================================
-- 047_welcome_message.sql
--
-- Add welcome_message column to accounts table to allow customization
-- of the opening welcome greeting message for AI and automated responses.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS welcome_message TEXT;
