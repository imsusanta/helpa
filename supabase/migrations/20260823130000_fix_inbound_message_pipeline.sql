-- ============================================================
-- Migration: 20260823130000_fix_inbound_message_pipeline.sql
-- Purpose: Repair the inbound (customer reply) message pipeline.
--
-- ROOT CAUSE this migration addresses:
--   `public.inbound_webhook_events` is written on the critical path of
--   every inbound WhatsApp message by
--   src/app/api/whatsapp/webhook/route.ts, and RLS policies for it were
--   added in 20260822124500_add_missing_rls_policies.sql — but the table
--   itself was never created by any migration. The insert therefore
--   failed with SQLSTATE 42P01 (undefined_table), the route treated that
--   as fatal, and every customer reply was rejected with HTTP 500 before
--   it was ever persisted. Outbound was unaffected because it does not
--   touch this table.
--
-- Also provisioned here:
--   2. Columns the inbound path depends on that no migration declares —
--      notably conversations.last_message_text (the inbox preview).
--   3. A DB-level uniqueness guard on messages.message_id so a retried
--      webhook delivery can never create a duplicate inbox message.
--   4. An atomic conversation-rollup function (preview text, timestamp,
--      unread counter, reopen-on-reply) so concurrent replies cannot lose
--      an unread increment via read-modify-write.
--   5. Realtime replication for `messages` and `conversations` so the
--      inbox updates live instead of waiting for the 4s safety-net poll.
--
-- SAFE to run multiple times — every statement is idempotent.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────
-- 1. inbound_webhook_events — durable inbound idempotency ledger
--    Shape matches src/types/database.ts exactly.
-- ────────────────────────────────────────────────────────────
create table if not exists public.inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  account_id uuid references public.accounts(id) on delete cascade,
  entry_id text,
  field text not null default 'messages',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'processing', 'completed', 'failed', 'dead_letter')),
  retry_count integer not null default 0 check (retry_count >= 0),
  error_log text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The provider event id (Meta `wamid.*`) is the idempotency key. The
-- webhook route relies on the unique violation raised here to detect a
-- retried delivery, so this index is load-bearing, not just an optimisation.
create unique index if not exists inbound_webhook_events_event_id_unique
  on public.inbound_webhook_events (event_id);

create index if not exists inbound_webhook_events_account_status_idx
  on public.inbound_webhook_events (account_id, status, created_at desc);

-- Supports the failed-event replay/alerting queries and the
-- /api/cron/cleanup-webhooks retention sweep.
create index if not exists inbound_webhook_events_status_created_idx
  on public.inbound_webhook_events (status, created_at)
  where status in ('failed', 'dead_letter');

alter table public.inbound_webhook_events enable row level security;

-- Mirrors the policy set already declared in
-- 20260822124500_add_missing_rls_policies.sql so that migration remains
-- satisfied whichever order the two are applied in.
drop policy if exists "inbound_webhook_events_select" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_insert" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_update" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_delete" on public.inbound_webhook_events;

create policy "inbound_webhook_events_select" on public.inbound_webhook_events
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

create policy "inbound_webhook_events_insert" on public.inbound_webhook_events
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create policy "inbound_webhook_events_update" on public.inbound_webhook_events
  for update to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create policy "inbound_webhook_events_delete" on public.inbound_webhook_events
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 2. conversations — columns the inbound path reads and writes
--
--    NOTE ON THIS REPO'S MIGRATIONS: they are patches applied against a
--    live schema, not a complete history. 20260815120000 backfills
--    `direction` FROM `sender_type` — a column no migration ever creates —
--    so a database built purely from this directory does not match the one
--    running in production.
--
--    `last_message_text` is in that category: every code path uses it
--    (conversation-service.ts writes it on create, the inbox list renders
--    it) but no migration declares it. Section 5 below references it from a
--    `language sql` function body, which Postgres validates at CREATE time,
--    so the guard must run first. Every statement is ADD COLUMN IF NOT
--    EXISTS and therefore a no-op against the live schema.
-- ────────────────────────────────────────────────────────────
alter table public.conversations
  add column if not exists last_message_text text default '';

alter table public.conversations
  add column if not exists user_id uuid;


-- ────────────────────────────────────────────────────────────
-- 3. messages — columns the inbound path writes
--
--    Same rationale as above. The outbound path in /api/whatsapp/send
--    already writes sender_type, message_id, media_url and template_name
--    successfully, which is how we know these exist in production; the
--    guards exist so a freshly-provisioned database also works.
-- ────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists updated_at timestamptz not null default now();

alter table public.messages
  add column if not exists sender_type text;

alter table public.messages
  add column if not exists message_id text;

alter table public.messages
  add column if not exists media_url text;

alter table public.messages
  add column if not exists reply_to_message_id uuid;

alter table public.messages
  add column if not exists interactive_reply_id text;


-- ────────────────────────────────────────────────────────────
-- 4. Duplicate-proofing on messages.message_id
--
--    `messages_provider_message_unique (account_id, provider_message_id)`
--    already exists, but inbound rows historically left
--    provider_message_id NULL so the index never applied to them. The
--    inbound path now populates both columns; this partial index closes
--    the remaining gap for rows written by older code paths and gives the
--    webhook a hard, race-free duplicate guard.
--
--    Wrapped in an exception handler: a database that already accumulated
--    duplicate rows (the very defect being fixed) would otherwise abort
--    the whole migration. We report and continue rather than blocking the
--    fix that stops new duplicates from being created.
-- ────────────────────────────────────────────────────────────
do $$
begin
  create unique index if not exists messages_message_id_unique
    on public.messages (message_id)
    where message_id is not null;
exception
  when unique_violation or duplicate_table then
    raise warning
      'messages_message_id_unique not created: pre-existing duplicate message_id rows. Deduplicate public.messages and re-run this migration to enable the hard duplicate guard.';
end $$;


-- ────────────────────────────────────────────────────────────
-- 5. Atomic conversation rollup for an inbound message
--
--    Replaces a read-modify-write in application code that lost unread
--    increments when two replies landed concurrently. Also reopens a
--    conversation that had been closed — otherwise a new reply stays
--    invisible behind the inbox's status filter.
--
--    Returns the resulting state so the change can be inspected from psql
--    without a second query. The output column names are deliberately NOT
--    the same as the underlying column names: RETURNS TABLE names act as OUT
--    parameters and can shadow column references inside the body.
-- ────────────────────────────────────────────────────────────
create or replace function public.apply_inbound_message_to_conversation(
  p_conversation_id uuid,
  p_preview text,
  p_message_at timestamptz
)
returns table (
  out_conversation_id uuid,
  out_unread_count integer,
  out_status text,
  out_last_message_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.conversations c
  set
    -- Only advance the preview/timestamp when this message is at least as
    -- recent as what we already show, so an out-of-order redelivery of an
    -- older message cannot rewind the thread preview.
    last_message_text = case
      when c.last_message_at is null or p_message_at >= c.last_message_at
        then p_preview
      else c.last_message_text
    end,
    last_message_at = case
      when c.last_message_at is null or p_message_at >= c.last_message_at
        then p_message_at
      else c.last_message_at
    end,
    -- Atomic increment: never reads the prior value into the application.
    unread_count = coalesce(c.unread_count, 0) + 1,
    -- A customer replying to a closed thread reopens it.
    status = case when c.status = 'closed' then 'open' else c.status end,
    updated_at = now()
  where c.id = p_conversation_id
  returning c.id, c.unread_count, c.status, c.last_message_at;
$$;

revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from anon;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from authenticated;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from public;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) to service_role;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) to postgres;


-- ────────────────────────────────────────────────────────────
-- 6. Realtime replication for the inbox
--
--    src/hooks/use-realtime.ts subscribes to postgres_changes on
--    `messages` and `conversations`, but neither table was ever added to
--    the `supabase_realtime` publication — so no event was ever
--    delivered and the inbox only updated on its 4-second fallback poll.
--    Row visibility is still gated by the existing RLS SELECT policies.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

commit;
