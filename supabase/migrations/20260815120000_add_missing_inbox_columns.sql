-- ============================================================
-- Migration: 20260815120000_add_missing_inbox_columns.sql
-- Purpose: Add missing columns (channel, account_id, direction,
--          provider_message_id) that the application code requires
--          but are not yet present in the live Supabase schema.
--
-- SAFE to run multiple times — every ALTER TABLE uses IF NOT EXISTS.
-- ============================================================

-- ── conversations ─────────────────────────────────────────────
-- 1. channel: WhatsApp / SMS / voice discriminator
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

-- 2. Backfill existing rows
UPDATE public.conversations
SET channel = 'whatsapp'
WHERE channel IS NULL OR channel = '';

-- 3. Add check constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_channel_check'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'voice'));
  END IF;
END $$;


-- ── messages ──────────────────────────────────────────────────
-- 4. account_id: tenant scoping
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS account_id uuid
  REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 5. Backfill account_id from parent conversation
UPDATE public.messages m
SET account_id = c.account_id
FROM public.conversations c
WHERE m.conversation_id = c.id
  AND m.account_id IS NULL;

-- 6. direction: inbound / outbound discriminator
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS direction text;

-- 7. Backfill direction from legacy sender_type if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_type'
  ) THEN
    EXECUTE 'UPDATE public.messages SET direction = CASE WHEN sender_type = ''customer'' THEN ''inbound'' ELSE ''outbound'' END WHERE direction IS NULL';
  END IF;
END $$;

-- 8. Add check constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_direction_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_direction_check
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

-- 9. provider_message_id: Meta / external message ID (nullable)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider_message_id text;

-- 10. Backfill provider_message_id from existing message_id column if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'message_id'
  ) THEN
    EXECUTE 'UPDATE public.messages SET provider_message_id = message_id WHERE provider_message_id IS NULL AND message_id IS NOT NULL';
  END IF;
END $$;


-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_account_id
  ON public.messages(account_id);

CREATE INDEX IF NOT EXISTS idx_messages_direction
  ON public.messages(direction);

CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON public.conversations(channel);

CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
  ON public.messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
