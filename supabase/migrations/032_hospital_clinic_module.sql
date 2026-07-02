-- ============================================================
-- 032_hospital_clinic_module.sql
--
-- Implement optional tenant modules and hospital/clinic tables.
-- Establish RLS policies and indexes.
-- ============================================================

-- 1. Create Tenant Modules Table (modular for other industries too)
CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL, -- e.g. 'hospital_clinic'
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_key)
);

ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant modules" ON tenant_modules
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage tenant modules" ON tenant_modules
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 2. Create Hospital Branches Table
CREATE TABLE IF NOT EXISTS hospital_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hospital branches" ON hospital_branches
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage hospital branches" ON hospital_branches
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 3. Create Hospital Branch Staff Mapping (access control)
CREATE TABLE IF NOT EXISTS hospital_branch_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES hospital_branches(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, profile_id)
);

ALTER TABLE hospital_branch_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view branch staff" ON hospital_branch_staff
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage branch staff" ON hospital_branch_staff
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 4. Create Doctors Table
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES hospital_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL, -- e.g. Cardiology, Pediatrics
  specialization TEXT,
  working_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "17:00"}',
  available_days TEXT[] NOT NULL DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  consultation_fee NUMERIC NOT NULL DEFAULT 0, -- in cents or default currency
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view doctors" ON hospital_doctors
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage doctors" ON hospital_doctors
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 5. Create Patients Table (extending contacts 1-to-1)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_seq_id TEXT UNIQUE NOT NULL, -- friendly ID e.g. PAT-10001
  gender TEXT,
  date_of_birth DATE,
  blood_group TEXT,
  address TEXT,
  emergency_contact TEXT,
  assigned_doctor_id UUID REFERENCES hospital_doctors(id) ON DELETE SET NULL,
  department TEXT,
  ai_summary TEXT,
  ai_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patients" ON patients
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage patients" ON patients
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 6. Create Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES hospital_branches(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES hospital_doctors(id) ON DELETE SET NULL,
  department TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled, no_show
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointments" ON appointments
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage appointments" ON appointments
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 7. Create Lab Reports Table
CREATE TABLE IF NOT EXISTS lab_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, collected, ready
  result_summary TEXT,
  file_url TEXT,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab reports" ON lab_reports
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage lab reports" ON lab_reports
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 8. Create Invoices Table
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, paid, partially_paid
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices" ON billing_invoices
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage invoices" ON billing_invoices
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 9. Create Feedback Table
CREATE TABLE IF NOT EXISTS appointments_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback" ON appointments_feedback
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage feedback" ON appointments_feedback
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 10. Auto updated_at triggers for all new tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hospital_branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hospital_doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lab_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON billing_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
