-- ============================================================
-- 027_ai_analytics_fields
--
-- Add columns to conversations table to support the AI Reply Engine
-- structured outputs (intent, lead score, sentiment, resolution, etc.).
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_intent TEXT,
  ADD COLUMN IF NOT EXISTS ai_lead_score TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS ai_handoff_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_faq_category TEXT;
