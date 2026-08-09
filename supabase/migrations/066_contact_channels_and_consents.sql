-- Migration: 066_contact_channels_and_consents.sql
-- Description: Multi-channel communication addresses and granular consent tracking.

CREATE TABLE IF NOT EXISTS public.contact_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'voice', 'email')),
  provider VARCHAR(32) NOT NULL,
  address VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  can_contact BOOLEAN NOT NULL DEFAULT true,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contact_channel_account_contact_address UNIQUE (account_id, contact_id, channel, address)
);

CREATE TABLE IF NOT EXISTS public.communication_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'voice', 'email')),
  consent_type VARCHAR(64) NOT NULL DEFAULT 'marketing',
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opted_in', 'opted_out')),
  source VARCHAR(64) NOT NULL DEFAULT 'web_form',
  evidence TEXT,
  policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_communication_consent UNIQUE (account_id, contact_id, channel, consent_type)
);

-- RLS Isolation
ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_channels_tenant_isolation"
  ON public.contact_channels
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "communication_consents_tenant_isolation"
  ON public.communication_consents
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

GRANT ALL ON TABLE public.contact_channels TO service_role;
GRANT ALL ON TABLE public.communication_consents TO service_role;
