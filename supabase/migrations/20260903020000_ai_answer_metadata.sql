-- Internal AI answer metadata for analytics and debugging.
-- Never shown to customers.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_answer_source TEXT,
  ADD COLUMN IF NOT EXISTS ai_answer_confidence TEXT,
  ADD COLUMN IF NOT EXISTS ai_question_type TEXT;
