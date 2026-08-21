-- ============================================================
-- Migration: 20260821000000_whatsapp_embedded_signup.sql
-- Purpose: Schema enhancements for Meta WhatsApp Embedded Signup,
--          OAuth state CSRF protection, and connection metadata.
-- ============================================================

begin;

-- ── 1. ENHANCE WHATSAPP_CONFIGS ────────────────────────────────
alter table public.whatsapp_configs
  add column if not exists waba_id text,
  add column if not exists phone_number text,
  add column if not exists display_phone_number text,
  add column if not exists verified_name text,
  add column if not exists business_name text,
  add column if not exists provider text not null default 'meta_embedded_signup',
  add column if not exists connection_error text,
  add column if not exists last_health_check_at timestamptz,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists registered_at timestamptz,
  add column if not exists subscribed_apps_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists disconnected_at timestamptz,
  add column if not exists connection_type text default 'standard',
  add column if not exists coexistence_status text default 'unknown';

create index if not exists idx_whatsapp_configs_phone_number_id on public.whatsapp_configs (phone_number_id);
create index if not exists idx_whatsapp_configs_account_status on public.whatsapp_configs (account_id, status);

-- Ensure full CRUD policies for admins on whatsapp_configs
drop policy if exists whatsapp_configs_insert on public.whatsapp_configs;
create policy whatsapp_configs_insert on public.whatsapp_configs
  for insert to authenticated with check (public.has_account_role(account_id, 'admin'));

drop policy if exists whatsapp_configs_update on public.whatsapp_configs;
create policy whatsapp_configs_update on public.whatsapp_configs
  for update to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

drop policy if exists whatsapp_configs_delete on public.whatsapp_configs;
create policy whatsapp_configs_delete on public.whatsapp_configs
  for delete to authenticated using (public.has_account_role(account_id, 'admin'));


-- ── 2. OAUTH STATES (CSRF & REPLAY PROTECTION) ─────────────────
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'meta_whatsapp',
  state text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_states_lookup on public.oauth_states (state, expires_at);
create index if not exists idx_oauth_states_account on public.oauth_states (account_id);

alter table public.oauth_states enable row level security;

create policy oauth_states_select on public.oauth_states
  for select to authenticated using (public.has_account_role(account_id, 'admin'));

create policy oauth_states_insert on public.oauth_states
  for insert to authenticated with check (public.has_account_role(account_id, 'admin'));

create policy oauth_states_update on public.oauth_states
  for update to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy oauth_states_delete on public.oauth_states
  for delete to authenticated using (public.has_account_role(account_id, 'admin'));

commit;
