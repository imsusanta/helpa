-- ============================================================
-- 026_ai_system_prompt
--
-- Add ai_system_prompt column to accounts table to allow customizing
-- the business rules/knowledge base for the AI Assistant.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;
