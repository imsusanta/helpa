-- ============================================================
-- Migration: 20260827010000_ai_lead_detection_and_followups.sql
-- Purpose: Additive schema for the AI lead-detection, qualification,
--          and smart follow-up layer. Extends public.leads; does not
--          replace deals, automations, or WhatsApp tables.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Extra columns on public.leads (all nullable / additive)
-- ------------------------------------------------------------
alter table public.leads
  add column if not exists conversation_id uuid,
  add column if not exists ai_buying_intent text,
  add column if not exists ai_lead_score text,
  add column if not exists ai_score_numeric integer,
  add column if not exists ai_summary text,
  add column if not exists ai_next_action text,
  add column if not exists ai_product_service text,
  add column if not exists ai_budget text,
  add column if not exists ai_timeline text,
  add column if not exists followup_status text not null default 'none',
  add column if not exists last_customer_reply_at timestamptz,
  add column if not exists last_automated_message_at timestamptz,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists followup_stopped_reason text,
  add column if not exists source_message_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_leads_followup_status'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint chk_leads_followup_status
      check (followup_status in (
        'none',
        'scheduled',
        'waiting_for_reply',
        'reminder_sent',
        'stopped',
        'human_takeover'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_leads_ai_score_numeric'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint chk_leads_ai_score_numeric
      check (
        ai_score_numeric is null
        or (ai_score_numeric >= 0 and ai_score_numeric <= 100)
      );
  end if;
end $$;

create index if not exists idx_leads_account_contact_active
  on public.leads (account_id, contact_id)
  where stage not in ('CONVERTED', 'LOST');

create index if not exists idx_leads_account_conversation
  on public.leads (account_id, conversation_id)
  where conversation_id is not null;

create unique index if not exists uq_leads_account_source_message
  on public.leads (account_id, source_message_id)
  where source_message_id is not null;

-- ------------------------------------------------------------
-- 2. Per-account follow-up policy (defaults live in application code)
-- ------------------------------------------------------------
create table if not exists public.followup_policies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  enabled boolean not null default true,
  max_reminders integer not null default 1,
  reminder_delay_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_followup_policies_account unique (account_id),
  constraint chk_followup_policies_max_reminders check (max_reminders >= 0 and max_reminders <= 3),
  constraint chk_followup_policies_delay check (reminder_delay_days >= 1 and reminder_delay_days <= 30)
);

alter table public.followup_policies enable row level security;

drop policy if exists "followup_policies_select" on public.followup_policies;
create policy "followup_policies_select" on public.followup_policies
  for select to authenticated
  using (
    is_account_member(account_id, 'viewer'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "followup_policies_insert" on public.followup_policies;
create policy "followup_policies_insert" on public.followup_policies
  for insert to authenticated, service_role
  with check (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "followup_policies_update" on public.followup_policies;
create policy "followup_policies_update" on public.followup_policies
  for update to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  )
  with check (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "followup_policies_delete" on public.followup_policies;
create policy "followup_policies_delete" on public.followup_policies
  for delete to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

grant select, insert, update, delete on table public.followup_policies to authenticated;
grant all on table public.followup_policies to service_role;

-- ------------------------------------------------------------
-- 3. Scheduled lead follow-ups (max 1 reminder per lead by policy)
-- ------------------------------------------------------------
create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  conversation_id uuid,
  contact_id uuid,
  followup_type text not null default 'reminder',
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled',
  attempt_number integer not null default 1,
  cancelled_reason text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_lead_followups_type check (followup_type in ('reminder', 'initial')),
  constraint chk_lead_followups_status check (status in (
    'scheduled',
    'processing',
    'cancelled',
    'sent',
    'failed',
    'skipped'
  )),
  constraint chk_lead_followups_attempt check (attempt_number >= 1 and attempt_number <= 3)
);

alter table public.lead_followups enable row level security;

drop policy if exists "lead_followups_select" on public.lead_followups;
create policy "lead_followups_select" on public.lead_followups
  for select to authenticated
  using (
    is_account_member(account_id, 'viewer'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_followups_insert" on public.lead_followups;
create policy "lead_followups_insert" on public.lead_followups
  for insert to authenticated, service_role
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_followups_update" on public.lead_followups;
create policy "lead_followups_update" on public.lead_followups
  for update to authenticated, service_role
  using (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  )
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_followups_delete" on public.lead_followups;
create policy "lead_followups_delete" on public.lead_followups
  for delete to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

grant select, insert, update, delete on table public.lead_followups to authenticated;
grant all on table public.lead_followups to service_role;

create unique index if not exists uq_lead_followups_idempotency
  on public.lead_followups (account_id, idempotency_key);

create unique index if not exists uq_lead_followups_active_reminder
  on public.lead_followups (account_id, lead_id, followup_type, attempt_number)
  where status in ('scheduled', 'processing', 'sent');

create index if not exists idx_lead_followups_due
  on public.lead_followups (scheduled_at)
  where status = 'scheduled';

create index if not exists idx_lead_followups_conversation
  on public.lead_followups (account_id, conversation_id)
  where conversation_id is not null;

-- ------------------------------------------------------------
-- 4. Allow cancelled automation waits (reply guard)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.automation_pending_executions') is not null then
    alter table public.automation_pending_executions
      drop constraint if exists automation_pending_executions_status_check;
    alter table public.automation_pending_executions
      add constraint automation_pending_executions_status_check
      check (status in ('pending', 'running', 'done', 'failed', 'cancelled'));
  end if;
end $$;

commit;
