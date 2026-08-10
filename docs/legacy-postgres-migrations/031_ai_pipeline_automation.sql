-- ============================================================
-- 031_ai_pipeline_automation
--
-- Adds AI-extracted insights and metrics to the deals table:
--   - ai_lead_score (hot, warm, cold)
--   - ai_buying_intent (genuine booking, service inquiry, etc.)
--   - ai_budget (extracted budget)
--   - ai_timeline (extracted timeline)
--   - ai_summary (short conversation summary)
--   - ai_next_action (recommended next action)
--   - ai_product_service (product/service of interest)
-- ============================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_lead_score TEXT,
  ADD COLUMN IF NOT EXISTS ai_buying_intent TEXT,
  ADD COLUMN IF NOT EXISTS ai_budget TEXT,
  ADD COLUMN IF NOT EXISTS ai_timeline TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_next_action TEXT,
  ADD COLUMN IF NOT EXISTS ai_product_service TEXT;
