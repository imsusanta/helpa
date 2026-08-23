-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-08-23.
-- This historical migration is already applied in production; do not reapply it there.

-- Migration: Automation & AI module — tenant chatbot controls
--
-- Purpose: the Automation & AI section needs an account-level master switch for
-- the WhatsApp AI chatbot, a response-style preference, and human-handoff
-- configuration. Before this migration the only AI on/off state was
-- per-conversation (`conversations.is_ai_enabled` / `ai_chat_enabled`), so a
-- tenant could not pause the receptionist for the whole workspace.
--
-- Design notes:
--   * No new table. These are per-tenant preferences on an existing tenant row,
--     so they live on `public.accounts` alongside `ai_system_prompt` and
--     `welcome_message`, which the AI pipeline already reads the same way.
--   * `accounts` already has RLS and account-scoped policies, so no new policy
--     is required and no cross-tenant surface is introduced.
--   * Idempotent (`add column if not exists`) so it is safe to re-run against
--     an environment that already has the columns.

begin;

alter table public.accounts
  add column if not exists ai_chatbot_enabled boolean not null default true;

alter table public.accounts
  add column if not exists ai_response_style text not null default 'friendly';

alter table public.accounts
  add column if not exists ai_handoff_enabled boolean not null default true;

-- Which real, backend-detectable signals should escalate to a human.
-- `human_request` maps to the explicit "talk to a person" detection in
-- src/core/ai/engine.ts + src/lib/whatsapp/ai.ts. `complaint` maps to the
-- structured `intent === 'complaint'` classification the reply pipeline
-- already produces. Only signals the engine can actually observe are stored.
alter table public.accounts
  add column if not exists ai_handoff_triggers jsonb not null
    default '{"human_request": true, "complaint": true}'::jsonb;

-- Constrain response style to the values the prompt builder understands, so a
-- bad write can never inject arbitrary text into the system prompt.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_ai_response_style_check'
  ) then
    alter table public.accounts
      add constraint accounts_ai_response_style_check
      check (ai_response_style in ('professional', 'friendly', 'concise'));
  end if;
end $$;

commit;
