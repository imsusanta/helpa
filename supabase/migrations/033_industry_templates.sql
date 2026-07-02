-- ============================================================
-- 033_industry_templates.sql
--
-- Support Industry Templates by adding columns, preloading modules,
-- and setting up Real Estate and Travel module tables with RLS.
-- ============================================================

-- 1. Add industry column to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS industry VARCHAR(50) DEFAULT NULL;

-- 3. Create Real Estate Properties Table
CREATE TABLE IF NOT EXISTS real_estate_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g. 'Apartment', 'House', 'Land'
  status TEXT NOT NULL DEFAULT 'Available', -- e.g. 'Available', 'Under Offer', 'Sold'
  price NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE real_estate_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view properties" ON real_estate_properties
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage properties" ON real_estate_properties
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 4. Create Real Estate Visits Table (Property tours/viewings)
CREATE TABLE IF NOT EXISTS real_estate_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  visit_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled', -- e.g. 'Scheduled', 'Completed', 'Cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE real_estate_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visits" ON real_estate_visits
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage visits" ON real_estate_visits
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 5. Create Travel Packages Table
CREATE TABLE IF NOT EXISTS travel_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view travel packages" ON travel_packages
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage travel packages" ON travel_packages
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 6. Create Travel Bookings Table
CREATE TABLE IF NOT EXISTS travel_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES travel_packages(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  travel_date DATE NOT NULL,
  guests_count INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending', -- e.g. 'Pending', 'Confirmed', 'Cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view travel bookings" ON travel_bookings
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage travel bookings" ON travel_bookings
  FOR ALL USING (is_account_member(account_id, 'admin'));
