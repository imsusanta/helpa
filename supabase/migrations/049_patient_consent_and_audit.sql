-- Migration: 049_patient_consent_and_audit.sql
-- Description: Adds DPDP consent fields to patients table and creates an append-only audit_logs table with RLS.

ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS consent_status VARCHAR(32) NOT NULL DEFAULT 'opted_in',
  ADD COLUMN IF NOT EXISTS consent_source VARCHAR(64) DEFAULT 'whatsapp_optin',
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(32) DEFAULT 'v1.0';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy for audit_logs
CREATE POLICY "Tenant Audit Log Isolation" ON public.audit_logs
  FOR ALL
  USING (account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid));
