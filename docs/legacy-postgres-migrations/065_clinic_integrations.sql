-- Migration: 065_clinic_integrations.sql
-- Description: Store multi-tenant clinic integration credentials & configuration
--   Supports voice (sarvam, xai, elevenlabs), whatsapp (meta, waha), sms (twilio, exotel), and calendly.

CREATE TABLE IF NOT EXISTS public.clinic_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  integration_type VARCHAR(32) NOT NULL CHECK (integration_type IN ('voice', 'whatsapp', 'sms', 'calendly')),
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('sarvam', 'xai', 'elevenlabs', 'meta', 'waha', 'twilio', 'exotel', 'calendly')),
  encrypted_credentials TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disconnected', 'error')),
  last_health_check_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_clinic_integration_account_provider UNIQUE (account_id, provider)
);

-- RLS Isolation Policies
ALTER TABLE public.clinic_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_integrations_tenant_isolation" ON public.clinic_integrations;
CREATE POLICY "clinic_integrations_tenant_isolation"
  ON public.clinic_integrations
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

-- Service role bypass
GRANT ALL ON TABLE public.clinic_integrations TO service_role;
