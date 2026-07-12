-- ============================================================
-- 044_system_settings.sql
--
-- Create system_settings table to store global configurations.
-- Enable RLS and establish public read policy.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read system settings (needed for landing page)
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON system_settings;
CREATE POLICY "Allow public read access to system_settings" ON system_settings
  FOR SELECT USING (true);

-- Pre-seed landing page video URLs
INSERT INTO system_settings (key, value) VALUES
  ('landing_hero_video_url', '"https://www.youtube.com/embed/gFx-NjTw3sM"'::jsonb),
  ('landing_action_video_url', '"https://www.youtube.com/embed/gFx-NjTw3sM"'::jsonb)
ON CONFLICT (key) DO NOTHING;
