-- ============================================================
-- 025_ai_chat_support
--
-- Add columns to support OpenRouter LLM AI chat integration.
-- ============================================================

-- Add AI credentials and configuration to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_model TEXT;

-- Add AI enabled flag to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN NOT NULL DEFAULT FALSE;
