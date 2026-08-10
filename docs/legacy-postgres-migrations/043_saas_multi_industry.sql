-- ============================================================
-- 043_saas_multi_industry.sql
--
-- Alter accounts table for multi-tenant settings.
-- Create Coaching and Real Estate module database tables.
-- Establish RLS policies and triggers.
-- ============================================================

-- 1. Alter accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'hospital' NOT NULL,
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;

-- ============================================================
-- COACHING MODULE TABLES
-- ============================================================

-- 2. Create Courses Table
CREATE TABLE IF NOT EXISTS coaching_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0, -- in default currency cents
  duration TEXT, -- e.g. "6 months"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coaching_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coaching courses" ON coaching_courses
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage coaching courses" ON coaching_courses
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 3. Create Batches Table
CREATE TABLE IF NOT EXISTS coaching_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES coaching_courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timing TEXT, -- e.g. "08:00 AM - 10:00 AM"
  teacher_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coaching_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coaching batches" ON coaching_batches
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage coaching batches" ON coaching_batches
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 4. Create Coaching Students Table (extending contacts 1-to-1)
CREATE TABLE IF NOT EXISTS coaching_students (
  id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  student_seq_id TEXT UNIQUE NOT NULL, -- e.g. STU-10001
  gender TEXT,
  date_of_birth DATE,
  parent_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coaching_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coaching students" ON coaching_students
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage coaching students" ON coaching_students
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 5. Create Admissions Table
CREATE TABLE IF NOT EXISTS coaching_admissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  course_id UUID REFERENCES coaching_courses(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES coaching_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed, cancelled
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coaching_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coaching admissions" ON coaching_admissions
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage coaching admissions" ON coaching_admissions
  FOR ALL USING (is_account_member(account_id, 'agent'));


-- ============================================================
-- REAL ESTATE MODULE TABLES
-- ============================================================

-- 6. Create Properties Table
CREATE TABLE IF NOT EXISTS realestate_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  price NUMERIC NOT NULL DEFAULT 0, -- in cents
  type TEXT, -- Apartment, Villa, Commercial, etc.
  bedrooms INT,
  bathrooms INT,
  amenities TEXT[],
  status TEXT NOT NULL DEFAULT 'available', -- available, sold, rented
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE realestate_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view properties" ON realestate_properties
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage properties" ON realestate_properties
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 7. Create Agents Table
CREATE TABLE IF NOT EXISTS realestate_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE realestate_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view realestate agents" ON realestate_agents
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage realestate agents" ON realestate_agents
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 8. Create Leads Table (extending contacts 1-to-1)
CREATE TABLE IF NOT EXISTS realestate_leads (
  id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_seq_id TEXT UNIQUE NOT NULL, -- e.g. RLD-10001
  budget NUMERIC,
  preferred_location TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new, contacted, viewing, offer, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE realestate_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view realestate leads" ON realestate_leads
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage realestate leads" ON realestate_leads
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 9. Create Site Visits Table
CREATE TABLE IF NOT EXISTS realestate_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES realestate_properties(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES realestate_agents(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE realestate_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view site visits" ON realestate_visits
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Agents can manage site visits" ON realestate_visits
  FOR ALL USING (is_account_member(account_id, 'agent'));


-- ============================================================
-- 10. Auto updated_at triggers for all new tables
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON coaching_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON coaching_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON coaching_students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON coaching_admissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON realestate_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON realestate_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON realestate_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON realestate_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
