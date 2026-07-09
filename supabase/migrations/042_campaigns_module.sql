-- ============================================================
-- 042_campaigns_module.sql
--
-- Alter broadcasts, appointments, and patients tables to support
-- the Campaigns module and automation features.
-- ============================================================

-- 1. Alter broadcasts table
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT CHECK (attachment_type IN ('image', 'document')),
  ADD COLUMN IF NOT EXISTS cta_type TEXT DEFAULT 'none' CHECK (cta_type IN ('none', 'appointment', 'review', 'url')),
  ADD COLUMN IF NOT EXISTS cta_text TEXT,
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN DEFAULT FALSE;

-- 2. Alter appointments table to reference campaigns (broadcasts)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_request_sent BOOLEAN DEFAULT FALSE;

-- Create index on appointments.campaign_id for performance
CREATE INDEX IF NOT EXISTS idx_appointments_campaign_id ON appointments(campaign_id);

-- 3. Alter patients table to track follow-up reminders
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS last_followup_sent_at TIMESTAMPTZ;
