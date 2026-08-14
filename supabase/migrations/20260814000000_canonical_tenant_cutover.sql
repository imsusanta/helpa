begin;

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'agent', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index if not exists account_members_user_account_idx on public.account_members (user_id, account_id) where active;

create or replace function public.is_active_account_member(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account_id and user_id = auth.uid() and active
  );
$$;
revoke all on function public.is_active_account_member(uuid) from public;
grant execute on function public.is_active_account_member(uuid) to authenticated;

create or replace function public.has_account_role(target_account_id uuid, minimum_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account_id and user_id = auth.uid() and active
      and case role when 'owner' then 4 when 'admin' then 3 when 'agent' then 2 else 1 end
        >= case minimum_role when 'owner' then 4 when 'admin' then 3 when 'agent' then 2 else 1 end
  );
$$;
revoke all on function public.has_account_role(uuid, text) from public;
grant execute on function public.has_account_role(uuid, text) to authenticated;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  name text not null default '',
  phone text,
  email text,
  address text,
  metadata jsonb not null default '{}'::jsonb,
  consent_status text not null default 'pending' check (consent_status in ('pending', 'opted_in', 'opted_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists contacts_account_created_idx on public.contacts (account_id, created_at desc);
create unique index if not exists contacts_account_phone_unique on public.contacts (account_id, phone) where phone is not null;
create unique index if not exists contacts_account_email_unique on public.contacts (account_id, lower(email)) where email is not null;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  contact_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'sms', 'voice')),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  foreign key (contact_id, account_id) references public.contacts(id, account_id) on delete restrict
);
create index if not exists conversations_account_updated_idx on public.conversations (account_id, updated_at desc);
create unique index if not exists conversations_contact_channel_unique on public.conversations (account_id, contact_id, channel);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  conversation_id uuid not null,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  content_type text not null default 'text',
  content_text text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  foreign key (conversation_id, account_id) references public.conversations(id, account_id) on delete restrict
);
create index if not exists messages_conversation_created_idx on public.messages (account_id, conversation_id, created_at);
create unique index if not exists messages_provider_message_unique on public.messages (account_id, provider_message_id) where provider_message_id is not null;

create table if not exists public.whatsapp_configs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  phone_number_id text not null unique,
  encrypted_access_token text not null,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  message_id uuid not null references public.messages(id) on delete restrict,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'retrying', 'dead_letter', 'unknown')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_result jsonb,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);
create index if not exists whatsapp_outbox_claim_idx on public.whatsapp_outbox (status, available_at) where status in ('pending', 'retrying');

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  provider text not null,
  provider_event_id text not null,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'retrying', 'dead_letter')),
  payload_file_id text,
  payload_hash text not null,
  attempt_count integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index if not exists webhook_events_account_status_idx on public.webhook_events (account_id, status, received_at);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  contact_id uuid not null,
  starts_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, account_id) references public.contacts(id, account_id) on delete restrict
);
create index if not exists appointments_account_starts_idx on public.appointments (account_id, starts_at);

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'pending',
  run_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_account_created_idx on public.audit_logs (account_id, created_at desc);

create table if not exists public.migration_identity_map (
  source_provider text not null,
  source_id text not null,
  destination_table text not null,
  destination_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (source_provider, source_id, destination_table),
  unique (destination_table, destination_id)
);

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.account_members enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.whatsapp_configs enable row level security;
alter table public.whatsapp_outbox enable row level security;
alter table public.webhook_events enable row level security;
alter table public.appointments enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.migration_identity_map enable row level security;

create policy account_members_select on public.account_members for select to authenticated using (user_id = auth.uid() or public.has_account_role(account_id, 'admin'));
create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy accounts_select on public.accounts for select to authenticated using (public.is_active_account_member(id));
create policy accounts_update on public.accounts for update to authenticated using (public.has_account_role(id, 'admin')) with check (public.has_account_role(id, 'admin'));

create policy contacts_select on public.contacts for select to authenticated using (public.is_active_account_member(account_id));
create policy contacts_insert on public.contacts for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy contacts_update on public.contacts for update to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
create policy contacts_delete on public.contacts for delete to authenticated using (public.has_account_role(account_id, 'admin'));

create policy conversations_select on public.conversations for select to authenticated using (public.is_active_account_member(account_id));
create policy conversations_insert on public.conversations for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy conversations_update on public.conversations for update to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
create policy conversations_delete on public.conversations for delete to authenticated using (public.has_account_role(account_id, 'admin'));

create policy messages_select on public.messages for select to authenticated using (public.is_active_account_member(account_id));
create policy appointments_select on public.appointments for select to authenticated using (public.is_active_account_member(account_id));
create policy reminder_jobs_select on public.reminder_jobs for select to authenticated using (public.is_active_account_member(account_id));
create policy audit_logs_select on public.audit_logs for select to authenticated using (public.has_account_role(account_id, 'admin'));
create policy whatsapp_configs_select on public.whatsapp_configs for select to authenticated using (public.has_account_role(account_id, 'admin'));

commit;
