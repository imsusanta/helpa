-- Voice + worker tables that previously lived only in Appwrite.
-- Required for the Supabase-only runtime after SDK excision.

create table if not exists public.voice_integrations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null,
  encrypted_credentials_reference text,
  api_key_encrypted text,
  agent_id text,
  provider_phone_number_id text,
  phone_number_id text,
  phone_number_masked text,
  status text not null default 'configured',
  capabilities jsonb,
  key_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider)
);

create table if not exists public.voice_commands (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  call_id uuid,
  command_type text,
  status text not null default 'pending',
  params_json jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists voice_commands_account_idempotency_idx
  on public.voice_commands (account_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.worker_health (
  worker_id text primary key,
  commit_sha text,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  last_scan_at timestamptz,
  last_success_at timestamptz,
  last_failure_code text,
  processed_count integer not null default 0,
  retry_count integer not null default 0,
  dead_letter_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.provider_events
  add column if not exists lock_owner text,
  add column if not exists lock_expires_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists raw_payload_path text;

alter table public.voice_integrations enable row level security;
alter table public.voice_commands enable row level security;
alter table public.worker_health enable row level security;

drop policy if exists voice_integrations_select on public.voice_integrations;
drop policy if exists voice_integrations_write on public.voice_integrations;
drop policy if exists voice_integrations_service on public.voice_integrations;
create policy voice_integrations_select
  on public.voice_integrations for select to authenticated
  using (
    public.is_active_account_member(account_id)
    or (select auth.role()) = 'service_role'
  );
create policy voice_integrations_write
  on public.voice_integrations for all to authenticated
  using (
    public.has_account_role(account_id, 'admin')
    or (select auth.role()) = 'service_role'
  )
  with check (
    public.has_account_role(account_id, 'admin')
    or (select auth.role()) = 'service_role'
  );

drop policy if exists voice_commands_select on public.voice_commands;
drop policy if exists voice_commands_write on public.voice_commands;
drop policy if exists voice_commands_service on public.voice_commands;
create policy voice_commands_select
  on public.voice_commands for select to authenticated
  using (
    public.is_active_account_member(account_id)
    or (select auth.role()) = 'service_role'
  );
create policy voice_commands_write
  on public.voice_commands for all to authenticated
  using (
    public.has_account_role(account_id, 'agent')
    or (select auth.role()) = 'service_role'
  )
  with check (
    public.has_account_role(account_id, 'agent')
    or (select auth.role()) = 'service_role'
  );

drop policy if exists worker_health_service on public.worker_health;
create policy worker_health_service
  on public.worker_health for all to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

grant all on table public.voice_integrations to service_role;
grant all on table public.voice_commands to service_role;
grant all on table public.worker_health to service_role;
