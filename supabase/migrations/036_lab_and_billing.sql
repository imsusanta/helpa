-- ============================================================
-- 036_lab_and_billing.sql
--
-- Adds lab reports and billing schemas for clinical management.
-- ============================================================

-- 1. Create sequence for friendly bill numbers
CREATE SEQUENCE IF NOT EXISTS bill_seq START WITH 50001;

-- 2. Create hospital_lab_reports table
CREATE TABLE IF NOT EXISTS hospital_lab_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'collected')),
  result_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports" ON hospital_lab_reports
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage reports" ON hospital_lab_reports
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 3. Create hospital_bills table
CREATE TABLE IF NOT EXISTS hospital_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  bill_number TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bills" ON hospital_bills
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage bills" ON hospital_bills
  FOR ALL USING (is_account_member(account_id, 'admin'));
