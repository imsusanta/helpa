-- ============================================================
-- Migration: 20260823140000_multichannel_inbound_support.sql
-- Purpose: Provision the server-side provider mappings and durable event
--          ledger used by WAHA and Twilio inbound webhooks.
--
-- The consolidated schema contains these tables, but the ordered Supabase
-- migrations did not. Keep this patch idempotent so existing installations
-- can apply it without data loss.
-- ============================================================

begin;

-- Provider configuration is intentionally server-owned. Webhook payloads may
-- contain account_id as a hint, but routes resolve the workspace by matching
-- recipient/session values in this table (service role only at runtime).
create table if not exists public.clinic_integrations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  integration_type text not null default 'sms',
  provider text not null,
  encrypted_credentials text not null default '',
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  last_health_check_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_integrations_type_check
    check (integration_type in ('voice', 'whatsapp', 'sms', 'calendly')),
  constraint clinic_integrations_status_check
    check (status in ('active', 'configured', 'degraded', 'disconnected', 'inactive', 'error')),
  constraint clinic_integrations_account_provider_unique
    unique (account_id, provider)
);

create index if not exists clinic_integrations_provider_status_idx
  on public.clinic_integrations (provider, status, account_id);

alter table public.clinic_integrations enable row level security;
drop policy if exists clinic_integrations_select on public.clinic_integrations;
drop policy if exists clinic_integrations_insert on public.clinic_integrations;
drop policy if exists clinic_integrations_update on public.clinic_integrations;
drop policy if exists clinic_integrations_delete on public.clinic_integrations;
drop policy if exists clinic_integrations_tenant_isolation on public.clinic_integrations;

create policy clinic_integrations_select
  on public.clinic_integrations for select to authenticated
  using (public.is_active_account_member(account_id) or (select auth.role()) = 'service_role');
create policy clinic_integrations_insert
  on public.clinic_integrations for insert to authenticated
  with check (public.has_account_role(account_id, 'admin') or (select auth.role()) = 'service_role');
create policy clinic_integrations_update
  on public.clinic_integrations for update to authenticated
  using (public.has_account_role(account_id, 'admin') or (select auth.role()) = 'service_role')
  with check (public.has_account_role(account_id, 'admin') or (select auth.role()) = 'service_role');
create policy clinic_integrations_delete
  on public.clinic_integrations for delete to authenticated
  using (public.has_account_role(account_id, 'admin') or (select auth.role()) = 'service_role');

grant all on table public.clinic_integrations to service_role;

-- Durable provider event ledger. A unique provider/external ID pair is the
-- authoritative webhook retry guard; message uniqueness remains enforced on
-- public.messages as a second line of defence.
create table if not exists public.provider_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  attempt_count integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_events_status_check
    check (status in ('received', 'queued', 'processing', 'processed', 'retrying', 'failed', 'dead_letter')),
  constraint provider_events_provider_external_unique
    unique (provider, external_event_id)
);

-- Existing consolidated/legacy schemas used a global (provider, event_id)
-- constraint. Provider IDs are only unique within a tenant, so remove those
-- old constraints before installing the account-scoped guard. Constraint
-- names cover both the ordered and consolidated schema variants.
alter table public.provider_events
  add column if not exists account_id uuid;
alter table public.provider_events
  add column if not exists external_event_id text;
alter table public.provider_events
  add column if not exists event_type text;
alter table public.provider_events
  add column if not exists payload_hash text;
alter table public.provider_events
  add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.provider_events
  add column if not exists status text not null default 'received';
alter table public.provider_events
  add column if not exists attempt_count integer not null default 0;
alter table public.provider_events
  add column if not exists received_at timestamptz not null default now();
alter table public.provider_events
  add column if not exists processed_at timestamptz;
alter table public.provider_events
  add column if not exists last_error text;
alter table public.provider_events
  add column if not exists created_at timestamptz not null default now();
alter table public.provider_events
  add column if not exists updated_at timestamptz not null default now();

alter table public.provider_events
  drop constraint if exists provider_events_provider_external_unique;
alter table public.provider_events
  drop constraint if exists uq_provider_external_event;
drop index if exists provider_events_provider_external_unique;
drop index if exists uq_provider_external_event;

create unique index if not exists provider_events_account_provider_external_unique
  on public.provider_events (account_id, provider, external_event_id);

create index if not exists provider_events_account_status_idx
  on public.provider_events (account_id, status, received_at desc);

alter table public.provider_events enable row level security;
drop policy if exists provider_events_select on public.provider_events;
drop policy if exists provider_events_insert on public.provider_events;
drop policy if exists provider_events_update on public.provider_events;
drop policy if exists provider_events_delete on public.provider_events;
drop policy if exists provider_events_tenant_isolation on public.provider_events;

create policy provider_events_select
  on public.provider_events for select to authenticated
  using (public.is_active_account_member(account_id) or (select auth.role()) = 'service_role');
create policy provider_events_insert
  on public.provider_events for insert to authenticated, service_role
  with check ((public.has_account_role(account_id, 'admin')) or (select auth.role()) = 'service_role');
create policy provider_events_update
  on public.provider_events for update to authenticated, service_role
  using ((public.has_account_role(account_id, 'admin')) or (select auth.role()) = 'service_role')
  with check ((public.has_account_role(account_id, 'admin')) or (select auth.role()) = 'service_role');
create policy provider_events_delete
  on public.provider_events for delete to authenticated, service_role
  using ((public.has_account_role(account_id, 'admin')) or (select auth.role()) = 'service_role');

grant all on table public.provider_events to service_role;

commit;
