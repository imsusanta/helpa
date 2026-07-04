-- Update hospital_lab_reports table schema for Report Status module
ALTER TABLE hospital_lab_reports DROP CONSTRAINT IF EXISTS hospital_lab_reports_status_check;

-- Add expected_delivery_date and report_pdf_url columns
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS report_pdf_url TEXT;

-- Update status constraint to support: pending, processing, ready, delivered
ALTER TABLE hospital_lab_reports ADD CONSTRAINT hospital_lab_reports_status_check CHECK (status IN ('pending', 'processing', 'ready', 'delivered'));

-- Enable RLS for agents
DROP POLICY IF EXISTS "Agents can manage reports" ON hospital_lab_reports;
CREATE POLICY "Agents can manage reports" ON hospital_lab_reports
  FOR ALL USING (is_account_member(account_id, 'agent'));
