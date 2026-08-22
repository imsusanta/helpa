-- ============================================================
-- Migration: 20260822150000_sales_crm_complete_schema.sql
-- Purpose: Complete Sales CRM schema covering leads, lead activities,
--          lead notes, tasks, quotations, quotation items,
--          invoices, invoice items, and invoice payments with
--          strict tenant isolation, schema upgrade safety, and RLS policies.
-- ============================================================

begin;

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

-- Upgrade safety: ensure all required columns exist if table was previously created
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


-- 2. LEAD ACTIVITIES / STAGE HISTORY TABLE
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


-- 4. TASKS / FOLLOW-UPS TABLE
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


-- 7. INVOICES TABLE (Customer Business Invoices)
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

commit;
