-- Migration: 20260827100000_create_trip_proposals_table.sql
-- Purpose: Create trip_proposals table for travel agency module with RLS and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.trip_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.travel_packages(id) ON DELETE SET NULL,
  proposal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 3,
  duration_nights INTEGER NOT NULL DEFAULT 2,
  start_date DATE,
  end_date DATE,
  adults_count INTEGER NOT NULL DEFAULT 2,
  children_count INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  base_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  inclusions TEXT[] NOT NULL DEFAULT ARRAY['Hotel Accommodation', 'Daily Breakfast & Dinner', 'Private Sightseeing Cab', 'All Toll & Driver Charges']::TEXT[],
  exclusions TEXT[] NOT NULL DEFAULT ARRAY['Airfare / Train Fare', 'Personal Expenses & Tips', 'Monument Entry Fees']::TEXT[],
  itinerary JSONB NOT NULL DEFAULT '[]'::jsonb,
  hotel_details TEXT,
  transport_details TEXT,
  notes TEXT,
  terms TEXT DEFAULT '50% advance for booking confirmation. Balance payment 7 days before trip start date.',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  sent_channel TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, proposal_number)
);

CREATE INDEX IF NOT EXISTS idx_trip_proposals_account_status ON public.trip_proposals(account_id, status);
CREATE INDEX IF NOT EXISTS idx_trip_proposals_contact ON public.trip_proposals(contact_id);
CREATE INDEX IF NOT EXISTS idx_trip_proposals_package ON public.trip_proposals(package_id);
CREATE INDEX IF NOT EXISTS idx_trip_proposals_created ON public.trip_proposals(account_id, created_at DESC);

ALTER TABLE public.trip_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trip_proposals' AND policyname = 'trip_proposals_select'
  ) THEN
    CREATE POLICY trip_proposals_select ON public.trip_proposals 
    FOR SELECT TO authenticated 
    USING (public.is_active_account_member(account_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trip_proposals' AND policyname = 'trip_proposals_insert'
  ) THEN
    CREATE POLICY trip_proposals_insert ON public.trip_proposals 
    FOR INSERT TO authenticated 
    WITH CHECK (public.is_active_account_member(account_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trip_proposals' AND policyname = 'trip_proposals_update'
  ) THEN
    CREATE POLICY trip_proposals_update ON public.trip_proposals 
    FOR UPDATE TO authenticated 
    USING (public.is_active_account_member(account_id))
    WITH CHECK (public.is_active_account_member(account_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trip_proposals' AND policyname = 'trip_proposals_delete'
  ) THEN
    CREATE POLICY trip_proposals_delete ON public.trip_proposals 
    FOR DELETE TO authenticated 
    USING (public.has_account_role(account_id, 'agent'));
  END IF;
END $$;

COMMIT;
