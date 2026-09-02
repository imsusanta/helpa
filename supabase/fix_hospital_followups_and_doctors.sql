-- ============================================================================
-- FIX: HOSPITAL FOLLOWUPS & HOSPITAL DOCTORS RELATIONSHIP
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tmqlzsyqlprioeoowmtk/sql/new
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. HOSPITAL BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.hospital_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_branches_account ON public.hospital_branches(account_id);
ALTER TABLE public.hospital_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_branches_select ON public.hospital_branches;
CREATE POLICY hospital_branches_select ON public.hospital_branches
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

DROP POLICY IF EXISTS hospital_branches_manage ON public.hospital_branches;
CREATE POLICY hospital_branches_manage ON public.hospital_branches
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, 'admin'::text))
  WITH CHECK (public.has_account_role(account_id, 'admin'::text));

-- 2. HOSPITAL DOCTORS TABLE
CREATE TABLE IF NOT EXISTS public.hospital_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.hospital_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  specialization TEXT,
  working_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "17:00"}'::jsonb,
  available_days TEXT[] NOT NULL DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  consultation_fee NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_doctors_account ON public.hospital_doctors(account_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_branch ON public.hospital_doctors(branch_id);
ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_doctors_select ON public.hospital_doctors;
CREATE POLICY hospital_doctors_select ON public.hospital_doctors
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

DROP POLICY IF EXISTS hospital_doctors_manage ON public.hospital_doctors;
CREATE POLICY hospital_doctors_manage ON public.hospital_doctors
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, 'agent'::text))
  WITH CHECK (public.has_account_role(account_id, 'agent'::text));

-- 3. HOSPITAL FOLLOWUPS TABLE
CREATE TABLE IF NOT EXISTS public.hospital_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  followup_type TEXT NOT NULL DEFAULT 'Follow-up Task',
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  last_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all required columns exist if the table already existed
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS doctor_id UUID;
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS assigned_user_id UUID;
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS followup_type TEXT NOT NULL DEFAULT 'Follow-up Task';
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS due_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.hospital_followups ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Add or fix Foreign Key Constraints safely
DO $$
BEGIN
  -- Foreign key: doctor_id -> hospital_doctors(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hospital_followups_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.hospital_followups
      ADD CONSTRAINT hospital_followups_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES public.hospital_doctors(id) ON DELETE SET NULL;
  END IF;

  -- Foreign key: patient_id -> contacts(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hospital_followups_patient_id_fkey'
  ) THEN
    ALTER TABLE public.hospital_followups
      ADD CONSTRAINT hospital_followups_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hospital_followups_account ON public.hospital_followups(account_id);
CREATE INDEX IF NOT EXISTS idx_hospital_followups_patient ON public.hospital_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_followups_doctor ON public.hospital_followups(doctor_id);
CREATE INDEX IF NOT EXISTS idx_hospital_followups_due_date ON public.hospital_followups(due_date);

ALTER TABLE public.hospital_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_followups_select ON public.hospital_followups;
CREATE POLICY hospital_followups_select ON public.hospital_followups
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

DROP POLICY IF EXISTS hospital_followups_manage ON public.hospital_followups;
CREATE POLICY hospital_followups_manage ON public.hospital_followups
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, 'agent'::text))
  WITH CHECK (public.has_account_role(account_id, 'agent'::text));

-- 4. PATIENTS TABLE (EXTENDING CONTACTS)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  patient_seq_id TEXT UNIQUE,
  gender TEXT,
  date_of_birth DATE,
  blood_group TEXT,
  address TEXT,
  emergency_contact TEXT,
  assigned_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
  department TEXT,
  ai_summary TEXT,
  ai_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_account ON public.patients(account_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON public.patients(assigned_doctor_id);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_select ON public.patients;
CREATE POLICY patients_select ON public.patients
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

DROP POLICY IF EXISTS patients_manage ON public.patients;
CREATE POLICY patients_manage ON public.patients
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, 'agent'::text))
  WITH CHECK (public.has_account_role(account_id, 'agent'::text));

COMMIT;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
