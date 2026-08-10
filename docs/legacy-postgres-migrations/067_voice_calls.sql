-- Migration: 067_voice_calls.sql
-- Description: Stores telephony calls, provider session IDs, transcripts, and event audit trails.

CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('sarvam', 'xai', 'elevenlabs')),
  external_call_id VARCHAR(255) NOT NULL,
  external_agent_id VARCHAR(255),
  external_phone_number_id VARCHAR(255),
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(32) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'transferred')),
  patient_phone VARCHAR(64) NOT NULL,
  clinic_phone VARCHAR(64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  outcome VARCHAR(64),
  summary TEXT,
  transcript TEXT,
  recording_url TEXT,
  failure_reason TEXT,
  human_handoff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_calls_account_external_id UNIQUE (account_id, external_call_id)
);

CREATE TABLE IF NOT EXISTS public.call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  external_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Isolation
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_tenant_isolation"
  ON public.calls
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "call_events_tenant_isolation"
  ON public.call_events
  FOR ALL
  USING (
    account_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid)
    OR current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

GRANT ALL ON TABLE public.calls TO service_role;
GRANT ALL ON TABLE public.call_events TO service_role;
