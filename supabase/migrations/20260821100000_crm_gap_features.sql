-- ============================================================
-- Migration: 20260821100000_crm_gap_features.sql
-- Purpose: Add support for Saved Filters, In-App Notifications,
--          and Contact Assignment with strict Multi-Tenant RLS.
-- ============================================================

begin;

-- ── 1. CONTACT & TASK ASSIGNMENT COLUMNS ────────────────────
alter table public.contacts
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_contacts_assigned_user on public.contacts (assigned_user_id);

create table if not exists public.hospital_followups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  patient_id uuid references public.contacts(id) on delete cascade,
  doctor_id uuid,
  followup_type text,
  due_date date,
  status text not null default 'scheduled',
  notes text,
  last_reminder_sent_at timestamptz,
  title text,
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hospital_followups
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists title text;

create index if not exists idx_hospital_followups_assigned_user on public.hospital_followups (assigned_user_id);

-- ── 2. SAVED FILTERS TABLE ────────────────────────────────────
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('contacts', 'leads', 'deals', 'tasks', 'appointments')),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, entity_type, name)
);

create index if not exists idx_saved_filters_account on public.saved_filters (account_id);
create index if not exists idx_saved_filters_user on public.saved_filters (user_id);
create index if not exists idx_saved_filters_entity on public.saved_filters (account_id, entity_type);

-- ── 3. IN-APP NOTIFICATIONS TABLE ─────────────────────────────
create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general' check (type in ('general', 'whatsapp', 'lead', 'task', 'appointment', 'ai_handoff', 'payment')),
  link_url text,
  is_read boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_in_app_notifications_account_user on public.in_app_notifications (account_id, user_id, is_read);
create index if not exists idx_in_app_notifications_created on public.in_app_notifications (created_at desc);

-- ── 4. ROW LEVEL SECURITY (RLS) ───────────────────────────────
alter table public.hospital_followups enable row level security;
alter table public.saved_filters enable row level security;
alter table public.in_app_notifications enable row level security;

-- Saved filters policies
create policy saved_filters_select on public.saved_filters for select to authenticated
  using (public.is_active_account_member(account_id));

create policy saved_filters_insert on public.saved_filters for insert to authenticated
  with check (public.has_account_role(account_id, 'agent'));

create policy saved_filters_update on public.saved_filters for update to authenticated
  using (public.has_account_role(account_id, 'agent'))
  with check (public.has_account_role(account_id, 'agent'));

create policy saved_filters_delete on public.saved_filters for delete to authenticated
  using (public.has_account_role(account_id, 'agent'));

-- In-App Notifications policies
create policy in_app_notifications_select on public.in_app_notifications for select to authenticated
  using (public.is_active_account_member(account_id) and (user_id = auth.uid() or user_id is null));

create policy in_app_notifications_insert on public.in_app_notifications for insert to authenticated
  with check (public.is_active_account_member(account_id));

create policy in_app_notifications_update on public.in_app_notifications for update to authenticated
  using (public.is_active_account_member(account_id) and (user_id = auth.uid() or user_id is null))
  with check (public.is_active_account_member(account_id));

create policy in_app_notifications_delete on public.in_app_notifications for delete to authenticated
  using (public.is_active_account_member(account_id) and (user_id = auth.uid() or user_id is null));

commit;
