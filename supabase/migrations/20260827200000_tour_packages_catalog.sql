-- Migration: 20260827200000_tour_packages_catalog.sql
-- Purpose: Upgrade travel_packages with structured catalog fields, add tour_package_departures and tour_package_itinerary_days tables.

BEGIN;

-- 1. Upgrade existing travel_packages table with catalog fields
-- Add new columns to travel_packages (the table already has: id, account_id, name, destination, duration_days, price, description, created_at, updated_at)
ALTER TABLE public.travel_packages
  ADD COLUMN IF NOT EXISTS package_code TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS duration_nights INTEGER,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS price_basis TEXT,
  ADD COLUMN IF NOT EXISTS hotel_details JSONB,
  ADD COLUMN IF NOT EXISTS transport_details JSONB,
  ADD COLUMN IF NOT EXISTS inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS booking_deadline DATE,
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Copy existing price to base_price where null
UPDATE public.travel_packages SET base_price = price WHERE base_price IS NULL AND price IS NOT NULL AND price > 0;

-- Add constraints safely and idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_base_price') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_base_price CHECK (base_price IS NULL OR base_price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_duration_days') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_duration_days CHECK (duration_days > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_duration_nights') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_duration_nights CHECK (duration_nights IS NULL OR duration_nights >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_status') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_status CHECK (status IN ('draft', 'published', 'sold_out', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_price_basis') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_price_basis CHECK (price_basis IS NULL OR price_basis IN ('per_person', 'per_couple', 'per_group'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_travel_packages_valid_dates') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT chk_travel_packages_valid_dates CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from);
  END IF;
END $$;

-- Unique constraint on (account_id, id) for composite foreign key tenant integrity
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_travel_packages_account_id_id') THEN
    ALTER TABLE public.travel_packages ADD CONSTRAINT uq_travel_packages_account_id_id UNIQUE (account_id, id);
  END IF;
END $$;

-- Unique package_code per account (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_packages_account_code
  ON public.travel_packages(account_id, package_code)
  WHERE package_code IS NOT NULL;

-- Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_travel_packages_status ON public.travel_packages(account_id, status);
CREATE INDEX IF NOT EXISTS idx_travel_packages_destination ON public.travel_packages(account_id, destination);
CREATE INDEX IF NOT EXISTS idx_travel_packages_valid_dates ON public.travel_packages(account_id, valid_from, valid_until);

ALTER TABLE public.travel_packages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_packages' AND policyname = 'travel_packages_select') THEN
    CREATE POLICY travel_packages_select ON public.travel_packages FOR SELECT TO authenticated USING (public.is_active_account_member(account_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_packages' AND policyname = 'travel_packages_manage') THEN
    CREATE POLICY travel_packages_manage ON public.travel_packages FOR ALL TO authenticated USING (public.has_account_role(account_id, 'agent')) WITH CHECK (public.has_account_role(account_id, 'agent'));
  END IF;
END $$;

-- 2. Tour Package Departures
CREATE TABLE IF NOT EXISTS public.tour_package_departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.travel_packages(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  departure_price NUMERIC(12,2),
  total_seats INTEGER,
  available_seats INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tour_package_departures_package_tenant
    FOREIGN KEY (account_id, package_id)
    REFERENCES public.travel_packages(account_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_departures_seats_positive CHECK (total_seats IS NULL OR total_seats >= 0),
  CONSTRAINT chk_departures_available_seats CHECK (available_seats IS NULL OR available_seats >= 0),
  CONSTRAINT chk_departures_available_le_total CHECK (total_seats IS NULL OR available_seats IS NULL OR available_seats <= total_seats),
  CONSTRAINT chk_departures_price_positive CHECK (departure_price IS NULL OR departure_price >= 0),
  CONSTRAINT chk_departures_status CHECK (status IN ('scheduled', 'sold_out', 'cancelled')),
  CONSTRAINT chk_departures_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tour_package_departures_package_tenant') THEN
    ALTER TABLE public.tour_package_departures
      ADD CONSTRAINT fk_tour_package_departures_package_tenant
      FOREIGN KEY (account_id, package_id)
      REFERENCES public.travel_packages(account_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_departures_account ON public.tour_package_departures(account_id);
CREATE INDEX IF NOT EXISTS idx_tour_departures_package ON public.tour_package_departures(package_id);
CREATE INDEX IF NOT EXISTS idx_tour_departures_dates ON public.tour_package_departures(package_id, start_date);

ALTER TABLE public.tour_package_departures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tour_package_departures' AND policyname = 'tour_package_departures_select') THEN
    CREATE POLICY tour_package_departures_select ON public.tour_package_departures FOR SELECT TO authenticated USING (public.is_active_account_member(account_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tour_package_departures' AND policyname = 'tour_package_departures_manage') THEN
    CREATE POLICY tour_package_departures_manage ON public.tour_package_departures FOR ALL TO authenticated USING (public.has_account_role(account_id, 'agent')) WITH CHECK (public.has_account_role(account_id, 'agent'));
  END IF;
END $$;

-- 3. Tour Package Itinerary Days
CREATE TABLE IF NOT EXISTS public.tour_package_itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.travel_packages(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meals TEXT,
  accommodation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tour_package_itinerary_package_tenant
    FOREIGN KEY (account_id, package_id)
    REFERENCES public.travel_packages(account_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_itinerary_day_number CHECK (day_number > 0),
  UNIQUE (package_id, day_number)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tour_package_itinerary_package_tenant') THEN
    ALTER TABLE public.tour_package_itinerary_days
      ADD CONSTRAINT fk_tour_package_itinerary_package_tenant
      FOREIGN KEY (account_id, package_id)
      REFERENCES public.travel_packages(account_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_itinerary_account ON public.tour_package_itinerary_days(account_id);
CREATE INDEX IF NOT EXISTS idx_tour_itinerary_package ON public.tour_package_itinerary_days(package_id, day_number);

ALTER TABLE public.tour_package_itinerary_days ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tour_package_itinerary_days' AND policyname = 'tour_package_itinerary_days_select') THEN
    CREATE POLICY tour_package_itinerary_days_select ON public.tour_package_itinerary_days FOR SELECT TO authenticated USING (public.is_active_account_member(account_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tour_package_itinerary_days' AND policyname = 'tour_package_itinerary_days_manage') THEN
    CREATE POLICY tour_package_itinerary_days_manage ON public.tour_package_itinerary_days FOR ALL TO authenticated USING (public.has_account_role(account_id, 'agent')) WITH CHECK (public.has_account_role(account_id, 'agent'));
  END IF;
END $$;

-- 4. Transactional RPC for Package + Itinerary + Departure Upsert
CREATE OR REPLACE FUNCTION public.upsert_tour_package_with_children(
  p_account_id UUID,
  p_package_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_package_data JSONB DEFAULT '{}'::jsonb,
  p_itinerary JSONB DEFAULT '[]'::jsonb,
  p_departures JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pkg_id UUID;
  v_result JSONB;
  v_name TEXT;
  v_destination TEXT;
  v_duration_days INTEGER;
  v_duration_nights INTEGER;
  v_package_code TEXT;
  v_summary TEXT;
  v_base_price NUMERIC(12,2);
  v_currency TEXT;
  v_price_basis TEXT;
  v_hotel_details JSONB;
  v_transport_details JSONB;
  v_inclusions JSONB;
  v_exclusions JSONB;
  v_terms_and_conditions TEXT;
  v_booking_deadline DATE;
  v_valid_from DATE;
  v_valid_until DATE;
  v_status TEXT;
  v_metadata JSONB;
  item JSONB;
  v_day_num INTEGER;
  v_idx INTEGER;
BEGIN
  -- Explicit tenant & role authorization
  IF (select auth.role()) = 'service_role' THEN
    IF p_user_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.account_members
        WHERE account_id = p_account_id AND user_id = p_user_id AND active
          AND role IN ('agent', 'admin', 'owner')
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: User % lacks agent role on account %', p_user_id, p_account_id;
      END IF;
    END IF;
  ELSE
    IF NOT public.has_account_role(p_account_id, 'agent') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Caller lacks agent role on account %', p_account_id;
    END IF;
  END IF;

  -- Extract fields from JSONB
  v_name := trim(p_package_data->>'name');
  v_destination := trim(p_package_data->>'destination');
  v_duration_days := (p_package_data->>'duration_days')::INTEGER;
  v_duration_nights := (p_package_data->>'duration_nights')::INTEGER;
  v_package_code := NULLIF(trim(p_package_data->>'package_code'), '');
  v_summary := NULLIF(trim(p_package_data->>'summary'), '');
  v_base_price := (p_package_data->>'base_price')::NUMERIC;
  v_currency := COALESCE(p_package_data->>'currency', 'INR');
  v_price_basis := NULLIF(trim(p_package_data->>'price_basis'), '');
  v_hotel_details := p_package_data->'hotel_details';
  v_transport_details := p_package_data->'transport_details';
  v_inclusions := COALESCE(p_package_data->'inclusions', '[]'::jsonb);
  v_exclusions := COALESCE(p_package_data->'exclusions', '[]'::jsonb);
  v_terms_and_conditions := NULLIF(trim(p_package_data->>'terms_and_conditions'), '');
  v_booking_deadline := (p_package_data->>'booking_deadline')::DATE;
  v_valid_from := (p_package_data->>'valid_from')::DATE;
  v_valid_until := (p_package_data->>'valid_until')::DATE;
  v_status := COALESCE(p_package_data->>'status', 'draft');
  v_metadata := COALESCE(p_package_data->'metadata', '{}'::jsonb);

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Package name is required';
  END IF;
  IF v_destination IS NULL OR length(v_destination) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Destination is required';
  END IF;
  IF v_duration_days IS NULL OR v_duration_days < 1 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Duration days must be at least 1';
  END IF;

  IF p_package_id IS NOT NULL THEN
    -- Verify existing package belongs to this account
    IF NOT EXISTS (SELECT 1 FROM public.travel_packages WHERE id = p_package_id AND account_id = p_account_id) THEN
      RAISE EXCEPTION 'PACKAGE_NOT_FOUND: Package % does not belong to account %', p_package_id, p_account_id;
    END IF;

    UPDATE public.travel_packages SET
      name = v_name,
      destination = v_destination,
      duration_days = v_duration_days,
      duration_nights = v_duration_nights,
      package_code = v_package_code,
      summary = v_summary,
      description = v_summary,
      base_price = v_base_price,
      price = COALESCE(v_base_price, 0),
      currency = v_currency,
      price_basis = v_price_basis,
      hotel_details = v_hotel_details,
      transport_details = v_transport_details,
      inclusions = v_inclusions,
      exclusions = v_exclusions,
      terms_and_conditions = v_terms_and_conditions,
      booking_deadline = v_booking_deadline,
      valid_from = v_valid_from,
      valid_until = v_valid_until,
      status = v_status,
      metadata = v_metadata,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = p_package_id AND account_id = p_account_id;

    v_pkg_id := p_package_id;
  ELSE
    INSERT INTO public.travel_packages (
      account_id, name, destination, duration_days, duration_nights, package_code,
      summary, description, base_price, price, currency, price_basis,
      hotel_details, transport_details, inclusions, exclusions, terms_and_conditions,
      booking_deadline, valid_from, valid_until, status, metadata,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      p_account_id, v_name, v_destination, v_duration_days, v_duration_nights, v_package_code,
      v_summary, v_summary, v_base_price, COALESCE(v_base_price, 0), v_currency, v_price_basis,
      v_hotel_details, v_transport_details, v_inclusions, v_exclusions, v_terms_and_conditions,
      v_booking_deadline, v_valid_from, v_valid_until, v_status, v_metadata,
      p_user_id, p_user_id, NOW(), NOW()
    ) RETURNING id INTO v_pkg_id;
  END IF;

  -- 2. Itinerary days transaction (atomic replacement)
  IF p_itinerary IS NOT NULL AND jsonb_typeof(p_itinerary) = 'array' THEN
    DELETE FROM public.tour_package_itinerary_days
    WHERE package_id = v_pkg_id AND account_id = p_account_id;

    v_idx := 1;
    FOR item IN SELECT * FROM jsonb_array_elements(p_itinerary)
    LOOP
      v_day_num := COALESCE((item->>'day_number')::INTEGER, v_idx);
      INSERT INTO public.tour_package_itinerary_days (
        account_id, package_id, day_number, title, description, meals, accommodation, created_at, updated_at
      ) VALUES (
        p_account_id,
        v_pkg_id,
        v_day_num,
        COALESCE(trim(item->>'title'), 'Day ' || v_day_num),
        NULLIF(trim(item->>'description'), ''),
        NULLIF(trim(item->>'meals'), ''),
        NULLIF(trim(item->>'accommodation'), ''),
        NOW(),
        NOW()
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- 3. Departures transaction (atomic replacement)
  IF p_departures IS NOT NULL AND jsonb_typeof(p_departures) = 'array' THEN
    DELETE FROM public.tour_package_departures
    WHERE package_id = v_pkg_id AND account_id = p_account_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_departures)
    LOOP
      INSERT INTO public.tour_package_departures (
        account_id, package_id, start_date, end_date, departure_price, total_seats, available_seats, status, metadata, created_at, updated_at
      ) VALUES (
        p_account_id,
        v_pkg_id,
        (item->>'start_date')::DATE,
        (item->>'end_date')::DATE,
        (item->>'departure_price')::NUMERIC,
        (item->>'total_seats')::INTEGER,
        COALESCE((item->>'available_seats')::INTEGER, (item->>'total_seats')::INTEGER),
        COALESCE(item->>'status', 'scheduled'),
        COALESCE(item->'metadata', '{}'::jsonb),
        NOW(),
        NOW()
      );
    END LOOP;
  END IF;

  -- Return serialized package record
  SELECT row_to_json(p)::jsonb INTO v_result
  FROM public.travel_packages p
  WHERE p.id = v_pkg_id AND p.account_id = p_account_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_tour_package_with_children(UUID, UUID, UUID, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_tour_package_with_children(UUID, UUID, UUID, JSONB, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_tour_package_with_children(UUID, UUID, UUID, JSONB, JSONB, JSONB) TO authenticated;

-- 5. Booking Idempotency & Concurrency Hardening
ALTER TABLE public.travel_bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_bookings_idempotency
  ON public.travel_bookings(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_bookings_unique_pending
  ON public.travel_bookings(account_id, contact_id, package_id, travel_date)
  WHERE status = 'Pending';

COMMIT;
