-- Migration: 070_provider_events_and_idempotency.sql
-- Description: Provider events for webhook deduplication and idempotency keys table for safe action replay prevention.

CREATE TABLE IF NOT EXISTS public.provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  external_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'processing', 'processed', 'retrying', 'failed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  CONSTRAINT uq_provider_external_event UNIQUE (provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  scope VARCHAR(64) NOT NULL,
  key VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  resource_type VARCHAR(64),
  resource_id VARCHAR(255),
  response JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_idempotency_scope_key UNIQUE (account_id, scope, key)
);

-- RLS Isolation
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_events_tenant_isolation"
  ON public.provider_events
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "idempotency_keys_tenant_isolation"
  ON public.idempotency_keys
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

GRANT ALL ON TABLE public.provider_events TO service_role;
GRANT ALL ON TABLE public.idempotency_keys TO service_role;
