-- Migration: Add OrcaRouter and Multi-Provider AI Columns to Accounts table
-- Ensures native column storage for AI Providers and Models

ALTER TABLE IF EXISTS public.accounts
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openrouter',
  ADD COLUMN IF NOT EXISTS ai_fallback_provider TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS openrouter_model TEXT DEFAULT 'google/gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
  ADD COLUMN IF NOT EXISTS orcarouter_model TEXT DEFAULT 'orcarouter/auto',
  ADD COLUMN IF NOT EXISTS orcarouter_api_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT;
