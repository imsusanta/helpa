-- Migration: 20260825120000_tenant_modules_and_industry_tables.sql
-- Purpose: Complete modular multi-industry SaaS tables and tenant_modules mapping.

BEGIN;

-- 1. Tenant Modules
CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_account ON public.tenant_modules(account_id);
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_modules' AND policyname = 'tenant_modules_select') THEN
    CREATE POLICY tenant_modules_select ON public.tenant_modules FOR SELECT TO authenticated USING (public.is_active_account_member(account_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_modules' AND policyname = 'tenant_modules_all') THEN
    CREATE POLICY tenant_modules_all ON public.tenant_modules FOR ALL TO authenticated USING (public.has_account_role(account_id, 'admin')) WITH CHECK (public.has_account_role(account_id, 'admin'));
  END IF;
END $$;

-- 2. Hospital / Healthcare Module
CREATE TABLE IF NOT EXISTS public.hospital_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_branches ENABLE ROW LEVEL SECURITY;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hospital_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hospital_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  tests_included JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_packages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hospital_lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hospital_lab_reports ENABLE ROW LEVEL SECURITY;

-- 3. Coaching / Education Module
CREATE TABLE IF NOT EXISTS public.coaching_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coaching_courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coaching_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.coaching_courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timing TEXT,
  teacher_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coaching_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coaching_students (
  id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  student_seq_id TEXT,
  batch_id UUID REFERENCES public.coaching_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coaching_students ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coaching_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coaching_fees ENABLE ROW LEVEL SECURITY;

-- 4. Real Estate Module
CREATE TABLE IF NOT EXISTS public.realestate_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'apartment',
  price NUMERIC NOT NULL DEFAULT 0,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft NUMERIC,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.realestate_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.realestate_site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.realestate_properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.realestate_site_visits ENABLE ROW LEVEL SECURITY;

-- 5. Restaurant Module
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.restaurant_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  reservation_time TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.restaurant_reservations ENABLE ROW LEVEL SECURITY;

-- 6. Gym / Fitness Module
CREATE TABLE IF NOT EXISTS public.gym_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gym_members (
  id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gym_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialization TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gym_trainers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gym_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trainer_id UUID REFERENCES public.gym_trainers(id) ON DELETE SET NULL,
  schedule TEXT,
  capacity INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gym_classes ENABLE ROW LEVEL SECURITY;

-- 7. Salon / Spa Module
CREATE TABLE IF NOT EXISTS public.salon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.salon_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.salon_staff ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.salon_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.salon_services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.salon_staff(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  booking_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.salon_bookings ENABLE ROW LEVEL SECURITY;

-- 8. Generic Multi-Industry Helper Policies
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'hospital_branches', 'hospital_doctors', 'hospital_departments', 'hospital_services', 'hospital_packages', 'hospital_lab_reports',
    'coaching_courses', 'coaching_batches', 'coaching_students', 'coaching_fees',
    'realestate_properties', 'realestate_site_visits',
    'restaurant_tables', 'restaurant_reservations',
    'gym_memberships', 'gym_members', 'gym_trainers', 'gym_classes',
    'salon_services', 'salon_staff', 'salon_bookings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_account_member(account_id))', tbl || '_select', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_manage', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_account_role(account_id, ''agent'')) WITH CHECK (public.has_account_role(account_id, ''agent''))', tbl || '_manage', tbl);
  END LOOP;
END $$;

COMMIT;
