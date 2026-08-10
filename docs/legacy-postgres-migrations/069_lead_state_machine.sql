-- Migration: 069_lead_state_machine.sql
-- Description: Lead stage history table to record deterministic transitions across canonical stages.

CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  previous_stage VARCHAR(64) NOT NULL,
  next_stage VARCHAR(64) NOT NULL,
  reason TEXT,
  source VARCHAR(64) NOT NULL DEFAULT 'system',
  actor_type VARCHAR(32) NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'ai', 'user', 'webhook')),
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Isolation
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_stage_history_tenant_isolation"
  ON public.lead_stage_history
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

GRANT ALL ON TABLE public.lead_stage_history TO service_role;
