-- Migration: 071_multichannel_followups.sql
-- Description: Multichannel sequence definitions, steps, enrollments, and background queue jobs.

CREATE TABLE IF NOT EXISTS public.followup_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.followup_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  channel VARCHAR(32) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'voice')),
  provider VARCHAR(32) NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  template_name VARCHAR(255),
  message_body TEXT,
  ai_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_followup_step_sequence_number UNIQUE (sequence_id, step_number)
);

CREATE TABLE IF NOT EXISTS public.followup_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id UUID,
  sequence_id UUID NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
  current_step_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  cancel_reason VARCHAR(64),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.followup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.followup_enrollments(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id UUID,
  sequence_id UUID NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.followup_steps(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(255) NOT NULL,
  result JSONB,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Isolation
ALTER TABLE public.followup_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followup_sequences_tenant_isolation"
  ON public.followup_sequences FOR ALL
  USING (account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid) OR current_setting('role', true) = 'service_role' OR (auth.jwt() ->> 'role' = 'service_role'));

CREATE POLICY "followup_steps_tenant_isolation"
  ON public.followup_steps FOR ALL
  USING (account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid) OR current_setting('role', true) = 'service_role' OR (auth.jwt() ->> 'role' = 'service_role'));

CREATE POLICY "followup_enrollments_tenant_isolation"
  ON public.followup_enrollments FOR ALL
  USING (account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid) OR current_setting('role', true) = 'service_role' OR (auth.jwt() ->> 'role' = 'service_role'));

CREATE POLICY "followup_jobs_tenant_isolation"
  ON public.followup_jobs FOR ALL
  USING (account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid) OR current_setting('role', true) = 'service_role' OR (auth.jwt() ->> 'role' = 'service_role'));

GRANT ALL ON TABLE public.followup_sequences TO service_role;
GRANT ALL ON TABLE public.followup_steps TO service_role;
GRANT ALL ON TABLE public.followup_enrollments TO service_role;
GRANT ALL ON TABLE public.followup_jobs TO service_role;
