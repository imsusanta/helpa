-- ============================================================
-- Migration: 20260822150000_sales_crm_complete_schema.sql
-- Purpose: Complete Sales CRM schema covering leads, lead activities,
--          lead notes, tasks, quotations, quotation items,
--          invoices, invoice items, and invoice payments with
--          strict tenant isolation, schema upgrade safety,
--          composite foreign keys, atomic RPCs, and RLS policies.
-- ============================================================

begin;

-- ============================================================
-- SECTION 1: DOCUMENT SEQUENCES TABLE & ATOMIC NUMBER GENERATORS
-- ============================================================
create table if not exists public.tenant_document_sequences (
  account_id uuid not null references public.accounts(id) on delete cascade,
  doc_type text not null check (doc_type in ('quotation', 'invoice')),
  prefix text not null,
  current_val integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, doc_type)
);

alter table public.tenant_document_sequences enable row level security;

drop policy if exists "tenant_sequences_select" on public.tenant_document_sequences;
create policy "tenant_sequences_select" on public.tenant_document_sequences
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "tenant_sequences_service" on public.tenant_document_sequences;
create policy "tenant_sequences_service" on public.tenant_document_sequences
  for all to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create or replace function public.generate_next_quotation_number(p_account_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_val integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  insert into public.tenant_document_sequences (account_id, doc_type, prefix, current_val, updated_at)
  values (p_account_id, 'quotation', 'QT-' || v_year || '-', 1, now())
  on conflict (account_id, doc_type)
  do update set
    current_val = public.tenant_document_sequences.current_val + 1,
    updated_at = now()
  returning current_val into v_next_val;

  return 'QT-' || v_year || '-' || lpad(v_next_val::text, 4, '0');
end;
$$;

create or replace function public.generate_next_invoice_number(p_account_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_val integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  insert into public.tenant_document_sequences (account_id, doc_type, prefix, current_val, updated_at)
  values (p_account_id, 'invoice', 'INV-' || v_year || '-', 1, now())
  on conflict (account_id, doc_type)
  do update set
    current_val = public.tenant_document_sequences.current_val + 1,
    updated_at = now()
  returning current_val into v_next_val;

  return 'INV-' || v_year || '-' || lpad(v_next_val::text, 4, '0');
end;
$$;


-- ============================================================
-- SECTION 2: LEADS TABLE & CHILD RELATIONS
-- ============================================================

-- 1. LEADS TABLE
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  phone text,
  email text,
  service text,
  stage text not null default 'NEW',
  source text,
  channel text,
  lead_score text,
  score text,
  value numeric(14,2) not null default 0,
  currency text not null default 'INR',
  assigned_user_id uuid references auth.users(id) on delete set null,
  lost_reason text,
  next_follow_up_at timestamptz,
  attention_required boolean not null default false,
  notes text,
  metadata jsonb,
  converted_at timestamptz,
  converted_contact_id uuid references public.contacts(id) on delete set null,
  converted_deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.leads
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists service text,
  add column if not exists stage text default 'NEW',
  add column if not exists source text,
  add column if not exists channel text,
  add column if not exists lead_score text,
  add column if not exists score text,
  add column if not exists value numeric(14,2) default 0,
  add column if not exists currency text default 'INR',
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists lost_reason text,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists attention_required boolean default false,
  add column if not exists notes text,
  add column if not exists metadata jsonb,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists converted_deal_id uuid references public.deals(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.leads where account_id is null) then
    raise exception 'Migration preflight failed: table public.leads has rows with NULL account_id';
  end if;
  update public.leads set
    name = coalesce(name, 'Unnamed Lead'),
    stage = coalesce(stage, 'NEW'),
    value = coalesce(value, 0),
    currency = coalesce(currency, 'INR'),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());
end $$;

-- Constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_leads_stage') then
    alter table public.leads add constraint chk_leads_stage
      check (stage in ('NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED', 'APPOINTMENT_OFFERED', 'BOOKED', 'CONFIRMED', 'FOLLOW_UP', 'ATTENDED', 'CONVERTED', 'LOST'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_leads_id_account') then
    alter table public.leads add constraint uq_leads_id_account unique (id, account_id);
  end if;
end $$;

alter table public.leads enable row level security;

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_leads_account_stage on public.leads(account_id, stage);
create index if not exists idx_leads_account_created on public.leads(account_id, created_at desc);
create index if not exists idx_leads_contact_id on public.leads(contact_id);
create index if not exists idx_leads_assigned_user on public.leads(account_id, assigned_user_id);


-- 2. LEAD ACTIVITIES TABLE
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  previous_stage text,
  next_stage text,
  reason text,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.lead_activities
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists activity_type text,
  add column if not exists previous_stage text,
  add column if not exists next_stage text,
  add column if not exists reason text,
  add column if not exists notes text,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.lead_activities where account_id is null or lead_id is null) then
    raise exception 'Migration preflight failed: table public.lead_activities has rows with NULL account_id or lead_id';
  end if;
  update public.lead_activities set
    activity_type = coalesce(activity_type, 'activity'),
    created_at = coalesce(created_at, now());
end $$;

-- Composite foreign key
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_lead_activities_lead_tenant') then
    alter table public.lead_activities add constraint fk_lead_activities_lead_tenant
      foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade;
  end if;
end $$;

alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert" on public.lead_activities
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_activities_update" on public.lead_activities;
create policy "lead_activities_update" on public.lead_activities
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_activities_delete" on public.lead_activities;
create policy "lead_activities_delete" on public.lead_activities
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_lead_activities_lead on public.lead_activities(lead_id, created_at desc);
create index if not exists idx_lead_activities_account on public.lead_activities(account_id, created_at desc);


-- 3. LEAD NOTES TABLE
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.lead_notes
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists author_id uuid references auth.users(id) on delete set null,
  add column if not exists note_text text,
  add column if not exists created_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.lead_notes where account_id is null or lead_id is null) then
    raise exception 'Migration preflight failed: table public.lead_notes has rows with NULL account_id or lead_id';
  end if;
  update public.lead_notes set
    note_text = coalesce(note_text, ''),
    created_at = coalesce(created_at, now());
end $$;

-- Composite foreign key
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_lead_notes_lead_tenant') then
    alter table public.lead_notes add constraint fk_lead_notes_lead_tenant
      foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade;
  end if;
end $$;

alter table public.lead_notes enable row level security;

drop policy if exists "lead_notes_select" on public.lead_notes;
create policy "lead_notes_select" on public.lead_notes
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_notes_insert" on public.lead_notes;
create policy "lead_notes_insert" on public.lead_notes
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_notes_update" on public.lead_notes;
create policy "lead_notes_update" on public.lead_notes
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "lead_notes_delete" on public.lead_notes;
create policy "lead_notes_delete" on public.lead_notes
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_lead_notes_lead on public.lead_notes(lead_id, created_at desc);


-- ============================================================
-- SECTION 3: TASKS / FOLLOW-UPS TABLE
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.tasks
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists due_at timestamptz default now(),
  add column if not exists status text default 'pending',
  add column if not exists priority text default 'medium',
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.tasks where account_id is null) then
    raise exception 'Migration preflight failed: table public.tasks has rows with NULL account_id';
  end if;
  update public.tasks set
    title = coalesce(title, 'Untitled Task'),
    status = coalesce(status, 'pending'),
    priority = coalesce(priority, 'medium'),
    due_at = coalesce(due_at, now()),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());
end $$;

-- Named check constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_tasks_status') then
    alter table public.tasks add constraint chk_tasks_status
      check (status in ('pending', 'in_progress', 'completed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_tasks_priority') then
    alter table public.tasks add constraint chk_tasks_priority
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_tasks_id_account') then
    alter table public.tasks add constraint uq_tasks_id_account unique (id, account_id);
  end if;
end $$;

alter table public.tasks enable row level security;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_tasks_account_due on public.tasks(account_id, due_at);
create index if not exists idx_tasks_account_status on public.tasks(account_id, status);
create index if not exists idx_tasks_lead_id on public.tasks(lead_id);
create index if not exists idx_tasks_contact_id on public.tasks(contact_id);
create index if not exists idx_tasks_deal_id on public.tasks(deal_id);


-- ============================================================
-- SECTION 4: QUOTATIONS & QUOTATION ITEMS
-- ============================================================

-- 5. QUOTATIONS TABLE
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  quotation_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  issue_date date not null default current_date,
  valid_until date,
  currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  terms text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, quotation_number)
);

-- Upgrade safety: ensure all columns exist
alter table public.quotations
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists quotation_number text,
  add column if not exists status text default 'draft',
  add column if not exists issue_date date default current_date,
  add column if not exists valid_until date,
  add column if not exists currency text default 'INR',
  add column if not exists subtotal numeric(14,2) default 0,
  add column if not exists discount_total numeric(14,2) default 0,
  add column if not exists tax_total numeric(14,2) default 0,
  add column if not exists total numeric(14,2) default 0,
  add column if not exists notes text,
  add column if not exists terms text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.quotations where account_id is null) then
    raise exception 'Migration preflight failed: table public.quotations has rows with NULL account_id';
  end if;
  update public.quotations set
    quotation_number = coalesce(quotation_number, 'QT-LEGACY-' || id::text),
    status = coalesce(status, 'draft'),
    issue_date = coalesce(issue_date, current_date),
    currency = coalesce(currency, 'INR'),
    subtotal = coalesce(subtotal, 0),
    discount_total = coalesce(discount_total, 0),
    tax_total = coalesce(tax_total, 0),
    total = coalesce(total, 0),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());
end $$;

-- Named check constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_quotations_status') then
    alter table public.quotations add constraint chk_quotations_status
      check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_quotations_id_account') then
    alter table public.quotations add constraint uq_quotations_id_account unique (id, account_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_quotations_account_number') then
    alter table public.quotations add constraint uq_quotations_account_number unique (account_id, quotation_number);
  end if;
end $$;

alter table public.quotations enable row level security;

drop policy if exists "quotations_select" on public.quotations;
create policy "quotations_select" on public.quotations
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotations_insert" on public.quotations;
create policy "quotations_insert" on public.quotations
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotations_update" on public.quotations;
create policy "quotations_update" on public.quotations
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotations_delete" on public.quotations;
create policy "quotations_delete" on public.quotations
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_quotations_account_status on public.quotations(account_id, status);
create index if not exists idx_quotations_contact on public.quotations(contact_id);
create index if not exists idx_quotations_deal on public.quotations(deal_id);


-- 6. QUOTATION ITEMS TABLE
create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0),
  line_total numeric(14,2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.quotation_items
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists quotation_id uuid references public.quotations(id) on delete cascade,
  add column if not exists description text,
  add column if not exists quantity numeric(12,2) default 1,
  add column if not exists unit_price numeric(14,2) default 0,
  add column if not exists discount numeric(14,2) default 0,
  add column if not exists tax_rate numeric(7,4) default 0,
  add column if not exists line_total numeric(14,2) default 0,
  add column if not exists position integer default 0,
  add column if not exists created_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.quotation_items where account_id is null or quotation_id is null) then
    raise exception 'Migration preflight failed: table public.quotation_items has rows with NULL account_id or quotation_id';
  end if;
  update public.quotation_items set
    description = coalesce(description, 'Item'),
    quantity = greatest(0.01, coalesce(quantity, 1)),
    unit_price = greatest(0, coalesce(unit_price, 0)),
    discount = greatest(0, coalesce(discount, 0)),
    tax_rate = greatest(0, coalesce(tax_rate, 0)),
    line_total = coalesce(line_total, quantity * unit_price),
    position = coalesce(position, 0),
    created_at = coalesce(created_at, now());
end $$;

-- Named check constraints & composite foreign key
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_quotation_items_quantity') then
    alter table public.quotation_items add constraint chk_quotation_items_quantity check (quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_quotation_items_unit_price') then
    alter table public.quotation_items add constraint chk_quotation_items_unit_price check (unit_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_quotation_items_discount') then
    alter table public.quotation_items add constraint chk_quotation_items_discount check (discount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_quotation_items_tax_rate') then
    alter table public.quotation_items add constraint chk_quotation_items_tax_rate check (tax_rate >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_quotation_items_quotation_tenant') then
    alter table public.quotation_items add constraint fk_quotation_items_quotation_tenant
      foreign key (quotation_id, account_id) references public.quotations(id, account_id) on delete cascade;
  end if;
end $$;

alter table public.quotation_items enable row level security;

drop policy if exists "quotation_items_select" on public.quotation_items;
create policy "quotation_items_select" on public.quotation_items
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotation_items_insert" on public.quotation_items;
create policy "quotation_items_insert" on public.quotation_items
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotation_items_update" on public.quotation_items;
create policy "quotation_items_update" on public.quotation_items
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "quotation_items_delete" on public.quotation_items;
create policy "quotation_items_delete" on public.quotation_items
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_quotation_items_quotation on public.quotation_items(quotation_id, position);


-- ============================================================
-- SECTION 5: INVOICES, INVOICE ITEMS & PAYMENTS
-- ============================================================

-- 7. INVOICES TABLE
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  notes text,
  terms text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, invoice_number)
);

-- Upgrade safety: ensure all columns exist
alter table public.invoices
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists quotation_id uuid references public.quotations(id) on delete set null,
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists invoice_number text,
  add column if not exists status text default 'draft',
  add column if not exists issue_date date default current_date,
  add column if not exists due_date date,
  add column if not exists currency text default 'INR',
  add column if not exists subtotal numeric(14,2) default 0,
  add column if not exists discount_total numeric(14,2) default 0,
  add column if not exists tax_total numeric(14,2) default 0,
  add column if not exists total numeric(14,2) default 0,
  add column if not exists amount_paid numeric(14,2) default 0,
  add column if not exists balance_due numeric(14,2) default 0,
  add column if not exists notes text,
  add column if not exists terms text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.invoices where account_id is null) then
    raise exception 'Migration preflight failed: table public.invoices has rows with NULL account_id';
  end if;
  update public.invoices set
    invoice_number = coalesce(invoice_number, 'INV-LEGACY-' || id::text),
    status = coalesce(status, 'draft'),
    issue_date = coalesce(issue_date, current_date),
    currency = coalesce(currency, 'INR'),
    subtotal = coalesce(subtotal, 0),
    discount_total = coalesce(discount_total, 0),
    tax_total = coalesce(tax_total, 0),
    total = coalesce(total, 0),
    amount_paid = coalesce(amount_paid, 0),
    balance_due = greatest(0, coalesce(balance_due, total - amount_paid)),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());
end $$;

-- Named check constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_invoices_status') then
    alter table public.invoices add constraint chk_invoices_status
      check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_invoices_balance_due') then
    alter table public.invoices add constraint chk_invoices_balance_due check (balance_due >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_invoices_id_account') then
    alter table public.invoices add constraint uq_invoices_id_account unique (id, account_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_invoices_account_number') then
    alter table public.invoices add constraint uq_invoices_account_number unique (account_id, invoice_number);
  end if;
end $$;

alter table public.invoices enable row level security;

drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoices_insert" on public.invoices;
create policy "invoices_insert" on public.invoices
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoices_update" on public.invoices;
create policy "invoices_update" on public.invoices
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoices_delete" on public.invoices;
create policy "invoices_delete" on public.invoices
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_invoices_account_status on public.invoices(account_id, status);
create index if not exists idx_invoices_contact on public.invoices(contact_id);
create index if not exists idx_invoices_quotation on public.invoices(quotation_id);
create index if not exists idx_invoices_deal on public.invoices(deal_id);


-- 8. INVOICE ITEMS TABLE
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0),
  line_total numeric(14,2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.invoice_items
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade,
  add column if not exists description text,
  add column if not exists quantity numeric(12,2) default 1,
  add column if not exists unit_price numeric(14,2) default 0,
  add column if not exists discount numeric(14,2) default 0,
  add column if not exists tax_rate numeric(7,4) default 0,
  add column if not exists line_total numeric(14,2) default 0,
  add column if not exists position integer default 0,
  add column if not exists created_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.invoice_items where account_id is null or invoice_id is null) then
    raise exception 'Migration preflight failed: table public.invoice_items has rows with NULL account_id or invoice_id';
  end if;
  update public.invoice_items set
    description = coalesce(description, 'Item'),
    quantity = greatest(0.01, coalesce(quantity, 1)),
    unit_price = greatest(0, coalesce(unit_price, 0)),
    discount = greatest(0, coalesce(discount, 0)),
    tax_rate = greatest(0, coalesce(tax_rate, 0)),
    line_total = coalesce(line_total, quantity * unit_price),
    position = coalesce(position, 0),
    created_at = coalesce(created_at, now());
end $$;

-- Named check constraints & composite foreign key
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_invoice_items_quantity') then
    alter table public.invoice_items add constraint chk_invoice_items_quantity check (quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_invoice_items_unit_price') then
    alter table public.invoice_items add constraint chk_invoice_items_unit_price check (unit_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_invoice_items_discount') then
    alter table public.invoice_items add constraint chk_invoice_items_discount check (discount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_invoice_items_tax_rate') then
    alter table public.invoice_items add constraint chk_invoice_items_tax_rate check (tax_rate >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_invoice_items_invoice_tenant') then
    alter table public.invoice_items add constraint fk_invoice_items_invoice_tenant
      foreign key (invoice_id, account_id) references public.invoices(id, account_id) on delete cascade;
  end if;
end $$;

alter table public.invoice_items enable row level security;

drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select" on public.invoice_items
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_items_insert" on public.invoice_items;
create policy "invoice_items_insert" on public.invoice_items
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_items_update" on public.invoice_items;
create policy "invoice_items_update" on public.invoice_items
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_items_delete" on public.invoice_items;
create policy "invoice_items_delete" on public.invoice_items
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id, position);


-- 9. INVOICE PAYMENTS TABLE
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash',
  reference_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Upgrade safety: ensure all columns exist
alter table public.invoice_payments
  add column if not exists account_id uuid references public.accounts(id) on delete cascade,
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade,
  add column if not exists amount numeric(14,2) default 0,
  add column if not exists payment_date date default current_date,
  add column if not exists payment_method text default 'cash',
  add column if not exists reference_note text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

-- Preflight & backfill
do $$
begin
  if exists (select 1 from public.invoice_payments where account_id is null or invoice_id is null) then
    raise exception 'Migration preflight failed: table public.invoice_payments has rows with NULL account_id or invoice_id';
  end if;
  update public.invoice_payments set
    amount = greatest(0.01, coalesce(amount, 1)),
    payment_date = coalesce(payment_date, current_date),
    payment_method = coalesce(payment_method, 'cash'),
    created_at = coalesce(created_at, now());
end $$;

-- Named check constraints & composite foreign key
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_invoice_payments_amount') then
    alter table public.invoice_payments add constraint chk_invoice_payments_amount check (amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_invoice_payments_invoice_tenant') then
    alter table public.invoice_payments add constraint fk_invoice_payments_invoice_tenant
      foreign key (invoice_id, account_id) references public.invoices(id, account_id) on delete cascade;
  end if;
end $$;

alter table public.invoice_payments enable row level security;

drop policy if exists "invoice_payments_select" on public.invoice_payments;
create policy "invoice_payments_select" on public.invoice_payments
  for select to authenticated
  using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_payments_insert" on public.invoice_payments;
create policy "invoice_payments_insert" on public.invoice_payments
  for insert to authenticated, service_role
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_payments_update" on public.invoice_payments;
create policy "invoice_payments_update" on public.invoice_payments
  for update to authenticated, service_role
  using (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role')
  with check (is_account_member(account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role');

drop policy if exists "invoice_payments_delete" on public.invoice_payments;
create policy "invoice_payments_delete" on public.invoice_payments
  for delete to authenticated, service_role
  using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id, payment_date desc);


-- ============================================================
-- SECTION 6: ATOMIC DATABASE RPC FUNCTIONS
-- ============================================================

-- 1. Atomic Quotation to Invoice Conversion RPC
create or replace function public.convert_quotation_to_invoice(
  p_account_id uuid,
  p_quotation_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote record;
  v_inv_number text;
  v_due_date date;
  v_invoice_id uuid;
  v_created_invoice record;
begin
  -- 1. Verify caller has agent role or service_role
  if not (is_account_member(p_account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role') then
    raise exception 'INSUFFICIENT_PERMISSIONS: Agent role required.' using errcode = '42501';
  end if;

  -- 2. Lock quotation FOR UPDATE to prevent race conditions
  select * into v_quote
  from public.quotations
  where id = p_quotation_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_quote.status = 'converted' or exists (
    select 1 from public.invoices where quotation_id = p_quotation_id and account_id = p_account_id
  ) then
    raise exception 'ALREADY_CONVERTED: This quotation has already been converted to an invoice.' using errcode = '23505';
  end if;

  -- 3. Concurrency-safe invoice number generation
  v_inv_number := generate_next_invoice_number(p_account_id);
  v_due_date := current_date + interval '14 days';

  -- 4. Insert Invoice
  insert into public.invoices (
    account_id,
    contact_id,
    quotation_id,
    deal_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    currency,
    subtotal,
    discount_total,
    tax_total,
    total,
    amount_paid,
    balance_due,
    notes,
    terms,
    created_by
  ) values (
    p_account_id,
    v_quote.contact_id,
    v_quote.id,
    v_quote.deal_id,
    v_inv_number,
    'draft',
    current_date,
    v_due_date,
    v_quote.currency,
    v_quote.subtotal,
    v_quote.discount_total,
    v_quote.tax_total,
    v_quote.total,
    0,
    v_quote.total,
    coalesce(v_quote.notes, 'Converted from Quotation ' || v_quote.quotation_number),
    v_quote.terms,
    p_user_id
  ) returning * into v_created_invoice;

  v_invoice_id := v_created_invoice.id;

  -- 5. Copy all line items
  insert into public.invoice_items (
    account_id,
    invoice_id,
    description,
    quantity,
    unit_price,
    discount,
    tax_rate,
    line_total,
    position
  )
  select
    p_account_id,
    v_invoice_id,
    qi.description,
    qi.quantity,
    qi.unit_price,
    qi.discount,
    qi.tax_rate,
    qi.line_total,
    qi.position
  from public.quotation_items qi
  where qi.quotation_id = p_quotation_id and qi.account_id = p_account_id
  order by qi.position asc, qi.created_at asc;

  -- 6. Update Quotation status to accepted & converted
  update public.quotations
  set
    status = 'converted',
    updated_at = now()
  where id = p_quotation_id and account_id = p_account_id;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_inv_number,
    'quotation_id', p_quotation_id,
    'total', v_created_invoice.total,
    'currency', v_created_invoice.currency
  );
end;
$$;


-- 2. Atomic Invoice Payment RPC
create or replace function public.record_invoice_payment(
  p_account_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_reference_note text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv record;
  v_payment_id uuid;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_updated_inv record;
begin
  -- 1. Check permissions
  if not (is_account_member(p_account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role') then
    raise exception 'INSUFFICIENT_PERMISSIONS: Agent role required.' using errcode = '42501';
  end if;

  -- 2. Validate payment amount
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: Payment amount must be positive.' using errcode = '22003';
  end if;

  -- 3. Lock invoice FOR UPDATE
  select * into v_inv
  from public.invoices
  where id = p_invoice_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_inv.status = 'void' then
    raise exception 'INVOICE_VOID: Cannot record payment against a void invoice.' using errcode = '22023';
  end if;

  if v_inv.status = 'paid' and v_inv.balance_due <= 0 then
    raise exception 'INVOICE_ALREADY_PAID: Invoice is already fully paid.' using errcode = '22023';
  end if;

  -- Prevent overpayment beyond total
  if (v_inv.amount_paid + p_amount) > v_inv.total then
    raise exception 'OVERPAYMENT_NOT_ALLOWED: Payment exceeds total balance due of %.', v_inv.balance_due using errcode = '22023';
  end if;

  -- 4. Record payment
  insert into public.invoice_payments (
    account_id,
    invoice_id,
    amount,
    payment_date,
    payment_method,
    reference_note,
    created_by
  ) values (
    p_account_id,
    p_invoice_id,
    p_amount,
    current_date,
    coalesce(p_payment_method, 'cash'),
    p_reference_note,
    p_user_id
  ) returning id into v_payment_id;

  -- 5. Recalculate amounts
  v_new_paid := v_inv.amount_paid + p_amount;
  v_new_balance := greatest(0, v_inv.total - v_new_paid);

  if v_new_balance = 0 or v_new_paid >= v_inv.total then
    v_new_status := 'paid';
  else
    v_new_status := 'partially_paid';
  end if;

  -- 6. Update invoice
  update public.invoices
  set
    amount_paid = v_new_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  where id = p_invoice_id and account_id = p_account_id
  returning * into v_updated_inv;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'amount_paid', v_new_paid,
    'balance_due', v_new_balance,
    'status', v_new_status,
    'total', v_updated_inv.total,
    'currency', v_updated_inv.currency
  );
end;
$$;

commit;
