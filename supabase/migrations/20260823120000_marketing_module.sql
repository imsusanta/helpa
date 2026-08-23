-- Migration: 20260823120000_marketing_module.sql
-- Purpose: Marketing module completion.
--   1. broadcasts: align schema drift (message, target_type, target_tag_id,
--      created_by columns written by /api/broadcasts), add 'paused' status
--      and paused_at timestamp for campaign pause/resume.
--   2. lead_forms: industry-aware lead capture forms with public share tokens.
--   3. form_submissions: per-tenant form submissions linked to contacts/leads.

-- ══════════════════════════════════════════════════════════════
-- 1. BROADCASTS — schema drift + paused status
-- ══════════════════════════════════════════════════════════════

alter table public.broadcasts
  add column if not exists message text;
alter table public.broadcasts
  add column if not exists target_type text default 'all';
alter table public.broadcasts
  add column if not exists target_tag_id uuid references public.tags(id) on delete set null;
alter table public.broadcasts
  add column if not exists created_by uuid;
alter table public.broadcasts
  add column if not exists paused_at timestamptz;

do $$
begin
  -- Replace the status CHECK to allow 'paused'. Guarded so re-runs are safe.
  if exists (
    select 1 from pg_constraint
    where conname = 'broadcasts_status_check'
      and conrelid = 'public.broadcasts'::regclass
  ) then
    alter table public.broadcasts drop constraint broadcasts_status_check;
  end if;
  alter table public.broadcasts add constraint broadcasts_status_check
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'paused'));
end $$;

create index if not exists idx_broadcasts_account_status
  on public.broadcasts(account_id, status);
create index if not exists idx_broadcasts_account_created
  on public.broadcasts(account_id, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- 2. LEAD FORMS
-- ══════════════════════════════════════════════════════════════

create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  description text,
  -- Opaque token for the public share link; avoids exposing internal ids.
  public_token uuid not null unique default gen_random_uuid(),
  -- Ordered array of field definitions:
  -- [{ key, label, type, required }] where type in ('text','email','phone',
  -- 'date','number','textarea')
  fields jsonb not null default '[]'::jsonb,
  success_message text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);

create index if not exists idx_lead_forms_account_status
  on public.lead_forms(account_id, status);
create index if not exists idx_lead_forms_public_token
  on public.lead_forms(public_token);

alter table public.lead_forms enable row level security;

drop policy if exists "lead_forms_select" on public.lead_forms;
create policy "lead_forms_select" on public.lead_forms
  for select to authenticated
  using (
    is_account_member(account_id, 'viewer'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_forms_insert" on public.lead_forms;
create policy "lead_forms_insert" on public.lead_forms
  for insert to authenticated, service_role
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_forms_update" on public.lead_forms;
create policy "lead_forms_update" on public.lead_forms
  for update to authenticated, service_role
  using (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  )
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "lead_forms_delete" on public.lead_forms;
create policy "lead_forms_delete" on public.lead_forms
  for delete to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

-- ══════════════════════════════════════════════════════════════
-- 3. FORM SUBMISSIONS
-- ══════════════════════════════════════════════════════════════

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  form_id uuid not null references public.lead_forms(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  -- Validated submission payload keyed by form field key.
  data jsonb not null default '{}'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'archived')),
  assigned_user_id uuid,
  source text not null default 'lead_form',
  -- Salted hash of submitter IP for abuse forensics — raw IPs never stored.
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);

create index if not exists idx_form_submissions_form_created
  on public.form_submissions(account_id, form_id, created_at desc);
create index if not exists idx_form_submissions_account_created
  on public.form_submissions(account_id, created_at desc);
create index if not exists idx_form_submissions_contact
  on public.form_submissions(contact_id);

alter table public.form_submissions enable row level security;

drop policy if exists "form_submissions_select" on public.form_submissions;
create policy "form_submissions_select" on public.form_submissions
  for select to authenticated
  using (
    is_account_member(account_id, 'viewer'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "form_submissions_insert" on public.form_submissions;
create policy "form_submissions_insert" on public.form_submissions
  for insert to service_role
  with check ((select auth.role()) = 'service_role');

drop policy if exists "form_submissions_update" on public.form_submissions;
create policy "form_submissions_update" on public.form_submissions
  for update to authenticated, service_role
  using (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  )
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "form_submissions_delete" on public.form_submissions;
create policy "form_submissions_delete" on public.form_submissions
  for delete to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );
