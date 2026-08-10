-- Migration: 068_calendly_integration.sql
-- Description: Calendly OAuth connections, event types, service mappings, and appointment synchronization.

CREATE TABLE IF NOT EXISTS public.calendly_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_uri VARCHAR(512) NOT NULL,
  user_uri VARCHAR(512) NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  webhook_subscription_uri VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_calendly_connection_account UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS public.calendly_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  external_uri VARCHAR(512) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  scheduling_url VARCHAR(512) NOT NULL,
  location_type VARCHAR(64) DEFAULT 'in_person',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_calendly_event_type_uri UNIQUE (account_id, external_uri)
);

CREATE TABLE IF NOT EXISTS public.service_event_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
  location_id UUID,
  calendly_event_type_id UUID NOT NULL REFERENCES public.calendly_event_types(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_service_mapping UNIQUE (account_id, service_name, doctor_id)
);

-- Extend appointments table with Calendly fields
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS calendly_event_uri VARCHAR(512),
  ADD COLUMN IF NOT EXISTS calendly_invitee_uri VARCHAR(512),
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri VARCHAR(512),
  ADD COLUMN IF NOT EXISTS booking_source VARCHAR(64) DEFAULT 'direct_ai',
  ADD COLUMN IF NOT EXISTS rescheduled_from_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(32) DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- RLS Isolation
ALTER TABLE public.calendly_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendly_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_event_type_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendly_connections_tenant_isolation"
  ON public.calendly_connections
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "calendly_event_types_tenant_isolation"
  ON public.calendly_event_types
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "service_event_type_mappings_tenant_isolation"
  ON public.service_event_type_mappings
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

GRANT ALL ON TABLE public.calendly_connections TO service_role;
GRANT ALL ON TABLE public.calendly_event_types TO service_role;
GRANT ALL ON TABLE public.service_event_type_mappings TO service_role;
