-- Migration: 20260827000000_add_conversation_ai_and_assignment_columns.sql
-- Purpose: Add missing AI and assignment columns to public.conversations table
--          and ensure public.outbound_outbox table exists for reliable outbound message dispatch.

BEGIN;

-- 1. Conversations columns
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_ai_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS ai_intent TEXT,
  ADD COLUMN IF NOT EXISTS ai_lead_score TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS ai_handoff_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_resolved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_faq_category TEXT,
  ADD COLUMN IF NOT EXISTS ai_autoreply_disabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reply_count INTEGER DEFAULT 0;

-- Backfill NULLs to default values for consistency
UPDATE public.conversations
SET ai_chat_enabled = true
WHERE ai_chat_enabled IS NULL;

UPDATE public.conversations
SET is_ai_enabled = true
WHERE is_ai_enabled IS NULL;

-- 2. Outbound Outbox Table for Idempotent and Durable Message Dispatch
CREATE TABLE IF NOT EXISTS public.outbound_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    meta_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'reconciliation_required', 'dead_letter')),
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT outbound_outbox_account_idempotency_key UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_outbound_outbox_account_status ON public.outbound_outbox(account_id, status);

ALTER TABLE public.outbound_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outbound_outbox' AND policyname = 'outbound_outbox_select') THEN
    CREATE POLICY outbound_outbox_select ON public.outbound_outbox
      FOR SELECT TO authenticated
      USING (public.is_active_account_member(account_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outbound_outbox' AND policyname = 'outbound_outbox_insert') THEN
    CREATE POLICY outbound_outbox_insert ON public.outbound_outbox
      FOR INSERT TO authenticated
      WITH CHECK (public.has_account_role(account_id, 'agent'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outbound_outbox' AND policyname = 'outbound_outbox_update') THEN
    CREATE POLICY outbound_outbox_update ON public.outbound_outbox
      FOR UPDATE TO authenticated
      USING (public.has_account_role(account_id, 'agent'))
      WITH CHECK (public.has_account_role(account_id, 'agent'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outbound_outbox' AND policyname = 'outbound_outbox_delete') THEN
    CREATE POLICY outbound_outbox_delete ON public.outbound_outbox
      FOR DELETE TO authenticated
      USING (public.has_account_role(account_id, 'admin'));
  END IF;
END $$;

COMMIT;
