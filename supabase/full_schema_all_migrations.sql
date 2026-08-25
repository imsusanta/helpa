-- Migration: 20260814000000_canonical_tenant_cutover.sql
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


-- Migration: 20260815100000_account_members_view.sql
-- Backward compatibility view for account_members referencing profiles
CREATE OR REPLACE VIEW public.account_members AS
SELECT 
  id,
  user_id,
  account_id,
  COALESCE(account_role::text, role, 'owner') AS role,
  true AS active,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.account_members TO authenticated, service_role, anon;


-- Migration: 20260815120000_add_missing_inbox_columns.sql
-- ============================================================
-- Migration: 20260815120000_add_missing_inbox_columns.sql
-- Purpose: Add missing columns (channel, account_id, direction,
--          provider_message_id) that the application code requires
--          but are not yet present in the live Supabase schema.
--
-- SAFE to run multiple times — every ALTER TABLE uses IF NOT EXISTS.
-- ============================================================

-- ── conversations ─────────────────────────────────────────────
-- 1. channel: WhatsApp / SMS / voice discriminator
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

-- 2. Backfill existing rows
UPDATE public.conversations
SET channel = 'whatsapp'
WHERE channel IS NULL OR channel = '';

-- 3. Add check constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_channel_check'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'voice'));
  END IF;
END $$;


-- ── messages ──────────────────────────────────────────────────
-- 4. account_id: tenant scoping
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS account_id uuid
  REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 5. Backfill account_id from parent conversation
UPDATE public.messages m
SET account_id = c.account_id
FROM public.conversations c
WHERE m.conversation_id = c.id
  AND m.account_id IS NULL;

-- 6. direction: inbound / outbound discriminator
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS direction text;

-- 7. Backfill direction from legacy sender_type
UPDATE public.messages
SET direction = CASE
  WHEN sender_type = 'customer' THEN 'inbound'
  ELSE 'outbound'
END
WHERE direction IS NULL;

-- 8. Add check constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_direction_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_direction_check
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

-- 9. provider_message_id: Meta / external message ID (nullable)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider_message_id text;

-- 10. Backfill provider_message_id from existing message_id column
UPDATE public.messages
SET provider_message_id = message_id
WHERE provider_message_id IS NULL AND message_id IS NOT NULL;


-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_account_id
  ON public.messages(account_id);

CREATE INDEX IF NOT EXISTS idx_messages_direction
  ON public.messages(direction);

CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON public.conversations(channel);

CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
  ON public.messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;


-- Migration: 20260817000000_add_orcarouter_and_ai_columns.sql
-- Migration: Add OrcaRouter and Multi-Provider AI Columns to Accounts table
-- Ensures native column storage for AI Providers and Models

ALTER TABLE IF EXISTS public.accounts
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openrouter',
  ADD COLUMN IF NOT EXISTS ai_fallback_provider TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS openrouter_model TEXT DEFAULT 'google/gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT,
  ADD COLUMN IF NOT EXISTS orcarouter_model TEXT DEFAULT 'orcarouter/auto',
  ADD COLUMN IF NOT EXISTS orcarouter_api_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT;


-- Migration: 20260820000000_helpa_saas_crm_automation_schema.sql
-- ============================================================
-- Migration: 20260820000000_helpa_saas_crm_automation_schema.sql
-- Purpose: Complete normalized schema for CRM Sales Pipelines, Deals,
--          Tags, Custom Fields, No-Code Automations, and
--          WhatsApp Conversation Flows with strict Multi-Tenant RLS.
-- ============================================================

begin;

-- ── 1. TAGS & CONTACT TAGS ────────────────────────────────────
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id)
);
create index if not exists idx_tags_account_id on public.tags (account_id);

create table if not exists public.contact_tags (
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
create index if not exists idx_contact_tags_account on public.contact_tags (account_id);
create index if not exists idx_contact_tags_tag on public.contact_tags (tag_id);


-- ── 2. CUSTOM FIELDS & VALUES ─────────────────────────────────
create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  key text not null,
  field_type text not null check (field_type in ('text', 'number', 'email', 'phone', 'date', 'dropdown', 'multiselect', 'boolean')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, key),
  unique (id, account_id)
);
create index if not exists idx_custom_fields_account on public.custom_fields (account_id);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  custom_field_id uuid not null references public.custom_fields(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_date timestamptz,
  value_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, custom_field_id)
);
create index if not exists idx_custom_field_values_account on public.custom_field_values (account_id);
create index if not exists idx_custom_field_values_contact on public.custom_field_values (contact_id);


-- ── 3. CRM PIPELINES & STAGES ─────────────────────────────────
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists idx_pipelines_account on public.pipelines (account_id);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  color text not null default '#64748b',
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages (pipeline_id, order_index);
create index if not exists idx_pipeline_stages_account on public.pipeline_stages (account_id);


-- ── 4. DEALS & DEAL ACTIVITIES ────────────────────────────────
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  value numeric not null default 0,
  currency text not null default 'USD',
  probability integer not null default 50,
  expected_close_date timestamptz,
  source text,
  notes text,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'abandoned')),
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists idx_deals_account_stage on public.deals (account_id, stage_id);
create index if not exists idx_deals_contact on public.deals (contact_id);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null default 'note',
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_deal_activities_deal on public.deal_activities (deal_id, created_at desc);


-- ── 5. NO-CODE AUTOMATIONS & WORKFLOWS ────────────────────────
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists idx_automations_account on public.automations (account_id);

create table if not exists public.automation_nodes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  label text not null default '',
  config jsonb not null default '{}'::jsonb,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, node_id)
);
create index if not exists idx_automation_nodes_automation on public.automation_nodes (automation_id);

create table if not exists public.automation_edges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  edge_id text not null,
  source_node_id text not null,
  target_node_id text not null,
  source_handle text,
  target_handle text,
  created_at timestamptz not null default now(),
  unique (automation_id, edge_id)
);
create index if not exists idx_automation_edges_automation on public.automation_edges (automation_id);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  trigger_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_node_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_automation_executions_account on public.automation_executions (account_id, status);

create table if not exists public.automation_execution_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  execution_id uuid not null references public.automation_executions(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  status text not null default 'success' check (status in ('success', 'failed', 'skipped')),
  input_data jsonb,
  output_data jsonb,
  error_message text,
  executed_at timestamptz not null default now()
);
create index if not exists idx_automation_execution_logs_exec on public.automation_execution_logs (execution_id, executed_at);


-- ── 6. WHATSAPP CONVERSATION FLOWS ────────────────────────────
create table if not exists public.conversation_flows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  trigger_keywords text[] default '{}',
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists idx_conversation_flows_account on public.conversation_flows (account_id);

create table if not exists public.flow_nodes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  flow_id uuid not null references public.conversation_flows(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  label text not null default '',
  content jsonb not null default '{}'::jsonb,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, node_id)
);
create index if not exists idx_flow_nodes_flow on public.flow_nodes (flow_id);

create table if not exists public.flow_edges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  flow_id uuid not null references public.conversation_flows(id) on delete cascade,
  edge_id text not null,
  source_node_id text not null,
  target_node_id text not null,
  source_handle text,
  target_handle text,
  created_at timestamptz not null default now(),
  unique (flow_id, edge_id)
);
create index if not exists idx_flow_edges_flow on public.flow_edges (flow_id);

create table if not exists public.flow_executions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  flow_id uuid not null references public.conversation_flows(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  current_node_id text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  variables jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_flow_executions_conv on public.flow_executions (conversation_id, status);


-- ── 7. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.deal_activities enable row level security;
alter table public.automations enable row level security;
alter table public.automation_nodes enable row level security;
alter table public.automation_edges enable row level security;
alter table public.automation_executions enable row level security;
alter table public.automation_execution_logs enable row level security;
alter table public.conversation_flows enable row level security;
alter table public.flow_nodes enable row level security;
alter table public.flow_edges enable row level security;
alter table public.flow_executions enable row level security;

-- Tags policies
create policy tags_select on public.tags for select to authenticated using (public.is_active_account_member(account_id));
create policy tags_insert on public.tags for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy tags_update on public.tags for update to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
create policy tags_delete on public.tags for delete to authenticated using (public.has_account_role(account_id, 'admin'));

-- Contact Tags policies
create policy contact_tags_select on public.contact_tags for select to authenticated using (public.is_active_account_member(account_id));
create policy contact_tags_insert on public.contact_tags for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy contact_tags_delete on public.contact_tags for delete to authenticated using (public.has_account_role(account_id, 'agent'));

-- Custom Fields policies
create policy custom_fields_select on public.custom_fields for select to authenticated using (public.is_active_account_member(account_id));
create policy custom_fields_insert on public.custom_fields for insert to authenticated with check (public.has_account_role(account_id, 'admin'));
create policy custom_fields_update on public.custom_fields for update to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));
create policy custom_fields_delete on public.custom_fields for delete to authenticated using (public.has_account_role(account_id, 'admin'));

-- Custom Field Values policies
create policy custom_field_values_select on public.custom_field_values for select to authenticated using (public.is_active_account_member(account_id));
create policy custom_field_values_insert on public.custom_field_values for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy custom_field_values_update on public.custom_field_values for update to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
create policy custom_field_values_delete on public.custom_field_values for delete to authenticated using (public.has_account_role(account_id, 'admin'));

-- Pipelines & Stages policies
create policy pipelines_select on public.pipelines for select to authenticated using (public.is_active_account_member(account_id));
create policy pipelines_all on public.pipelines for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy pipeline_stages_select on public.pipeline_stages for select to authenticated using (public.is_active_account_member(account_id));
create policy pipeline_stages_all on public.pipeline_stages for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

-- Deals & Deal Activities policies
create policy deals_select on public.deals for select to authenticated using (public.is_active_account_member(account_id));
create policy deals_insert on public.deals for insert to authenticated with check (public.has_account_role(account_id, 'agent'));
create policy deals_update on public.deals for update to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
create policy deals_delete on public.deals for delete to authenticated using (public.has_account_role(account_id, 'admin'));

create policy deal_activities_select on public.deal_activities for select to authenticated using (public.is_active_account_member(account_id));
create policy deal_activities_insert on public.deal_activities for insert to authenticated with check (public.has_account_role(account_id, 'agent'));

-- Automations & Executions policies
create policy automations_select on public.automations for select to authenticated using (public.is_active_account_member(account_id));
create policy automations_all on public.automations for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy automation_nodes_select on public.automation_nodes for select to authenticated using (public.is_active_account_member(account_id));
create policy automation_nodes_all on public.automation_nodes for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy automation_edges_select on public.automation_edges for select to authenticated using (public.is_active_account_member(account_id));
create policy automation_edges_all on public.automation_edges for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy automation_executions_select on public.automation_executions for select to authenticated using (public.is_active_account_member(account_id));
create policy automation_execution_logs_select on public.automation_execution_logs for select to authenticated using (public.is_active_account_member(account_id));

-- Conversation Flows & Executions policies
create policy conversation_flows_select on public.conversation_flows for select to authenticated using (public.is_active_account_member(account_id));
create policy conversation_flows_all on public.conversation_flows for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy flow_nodes_select on public.flow_nodes for select to authenticated using (public.is_active_account_member(account_id));
create policy flow_nodes_all on public.flow_nodes for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy flow_edges_select on public.flow_edges for select to authenticated using (public.is_active_account_member(account_id));
create policy flow_edges_all on public.flow_edges for all to authenticated using (public.has_account_role(account_id, 'admin')) with check (public.has_account_role(account_id, 'admin'));

create policy flow_executions_select on public.flow_executions for select to authenticated using (public.is_active_account_member(account_id));

commit;


-- Migration: 20260820100000_create_platform_payments.sql
-- ============================================================
-- Migration: 20260820100000_create_platform_payments.sql
-- Purpose: Permanent, idempotent financial transaction storage for SaaS subscriptions & renewals.
-- ============================================================

begin;

-- Helper function in case it doesn't exist yet
create or replace function public.is_active_account_member(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account_id and user_id = auth.uid() and active
  );
$$;
grant execute on function public.is_active_account_member(uuid) to authenticated;
grant execute on function public.is_active_account_member(uuid) to service_role;

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  razorpay_order_id text not null,
  razorpay_payment_id text not null,
  razorpay_signature text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  plan_slug text not null check (plan_slug in ('starter', 'growth', 'pro', 'custom')),
  payment_type text not null check (payment_type in ('setup_and_first_month', 'monthly_renewal', 'upgrade', 'downgrade', 'manual_adjustment')),
  status text not null check (status in ('captured', 'failed', 'refunded', 'pending')),
  is_setup_fee_included boolean not null default false,
  setup_fee_amount numeric(12, 2) not null default 0.00,
  monthly_recurring_amount numeric(12, 2) not null default 0.00,
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_platform_payments_payment_id unique (razorpay_payment_id),
  constraint uq_platform_payments_order_id unique (razorpay_order_id)
);

create index if not exists idx_platform_payments_account_id on public.platform_payments(account_id);
create index if not exists idx_platform_payments_created_at on public.platform_payments(created_at desc);
create index if not exists idx_platform_payments_status on public.platform_payments(status);

alter table public.platform_payments enable row level security;

drop policy if exists "Tenant members can view own account payments" on public.platform_payments;
create policy "Tenant members can view own account payments"
  on public.platform_payments
  for select
  using (
    exists (
      select 1 from public.account_members
      where account_members.account_id = platform_payments.account_id
      and account_members.user_id = auth.uid()
      and account_members.active = true
    )
    or exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
      and (profiles.is_super_admin = true or profiles.email = 'susantalohr@gmail.com')
    )
  );

drop policy if exists "Service role and Super Admins manage platform payments" on public.platform_payments;
create policy "Service role and Super Admins manage platform payments"
  on public.platform_payments
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
      and (profiles.is_super_admin = true or profiles.email = 'susantalohr@gmail.com')
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
      and (profiles.is_super_admin = true or profiles.email = 'susantalohr@gmail.com')
    )
  );

commit;


-- Migration: 20260820150000_appointment_reminder_idempotency.sql
begin;

create unique index if not exists uq_pending_appointment_reminder
  on public.automation_pending_executions (
    automation_id,
    ((context ->> 'appointment_id'))
  )
  where status = 'pending'
    and (context ->> 'appointment_id') is not null;

commit;


-- Migration: 20260821000000_whatsapp_embedded_signup.sql
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


-- Migration: 20260821100000_crm_gap_features.sql
-- ============================================================
-- Migration: 20260821100000_crm_gap_features.sql
-- Purpose: Add support for Saved Filters, In-App Notifications,
--          and Contact Assignment with strict Multi-Tenant RLS.
-- ============================================================

begin;

-- ── 1. CONTACT & TASK ASSIGNMENT COLUMNS ────────────────────
alter table public.contacts
  add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_contacts_assigned_user on public.contacts (assigned_user_id);

alter table public.hospital_followups
  add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists title text;

create index if not exists idx_hospital_followups_assigned_user on public.hospital_followups (assigned_user_id);

-- ── 2. SAVED FILTERS TABLE ────────────────────────────────────
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
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
  user_id uuid references public.profiles(id) on delete cascade,
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


-- Migration: 20260821150000_super_admin_role_hardening.sql
-- Remove email-based platform authorization and protect the super-admin flag.
begin;

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- Authenticated users may edit safe profile fields, but never elevate their own
-- platform role. Service-role operations retain full access.
revoke update on table public.profiles from authenticated;
grant update (full_name, updated_at) on table public.profiles to authenticated;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_super_admin = true
  );
$$;

revoke all on function public.is_platform_super_admin() from public;
grant execute on function public.is_platform_super_admin() to authenticated;
grant execute on function public.is_platform_super_admin() to service_role;

-- Replace policies that previously accepted a hardcoded email address.
drop policy if exists "Tenant members can view own account payments"
  on public.platform_payments;
create policy "Tenant members can view own account payments"
  on public.platform_payments
  for select
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

drop policy if exists "Service role and Super Admins manage platform payments"
  on public.platform_payments;
create policy "Service role and Super Admins manage platform payments"
  on public.platform_payments
  for all
  using (
    auth.role() = 'service_role'
    or public.is_platform_super_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.is_platform_super_admin()
  );

commit;


-- Migration: 20260822120000_fix_whatsapp_configs_security_invoker.sql
-- ============================================================
-- Migration: 20260822120000_fix_whatsapp_configs_security_invoker.sql
-- Purpose: Fix Supabase Lint: "Security Definer View" on public.whatsapp_configs.
--          Enforces security_invoker = true so querying users are bound by RLS.
-- ============================================================

begin;

-- If public.whatsapp_configs is a VIEW, set security_invoker to true
do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public' and viewname = 'whatsapp_configs'
  ) then
    execute 'alter view public.whatsapp_configs set (security_invoker = true)';
  end if;
end $$;

commit;


-- Migration: 20260822120500_fix_account_members_security_invoker.sql
-- ============================================================
-- Migration: 20260822120500_fix_account_members_security_invoker.sql
-- Purpose: Fix Supabase Lint: "Security Definer View" on public.account_members.
--          Enforces security_invoker = true so querying users are bound by profiles RLS.
-- ============================================================

begin;

-- If public.account_members is a VIEW, set security_invoker to true
do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public' and viewname = 'account_members'
  ) then
    execute 'alter view public.account_members set (security_invoker = true)';
  end if;
end $$;

commit;


-- Migration: 20260822121500_harden_functions_security_advisor.sql
-- ============================================================
-- Migration: 20260822121500_harden_functions_security_advisor.sql
-- Purpose: Resolve all 50 database security advisor warnings:
--          1. Enforces immutable search_path (search_path = public, pg_temp)
--          2. Revokes public/anon/authenticated execution on internal functions
--          3. Grants execute exclusively to service_role and postgres
-- ============================================================

begin;

do $$
declare
  r record;
begin
  for r in (
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ) loop
    -- 1. Fix mutable search_path
    execute format('alter function public.%I(%s) set search_path = public, pg_temp', r.proname, r.args);
    
    -- 2. Revoke public/anon/authenticated execution
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from authenticated', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from public', r.proname, r.args);
    
    -- 3. Grant exclusively to service_role and postgres
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to postgres', r.proname, r.args);
  end loop;
end $$;

commit;


-- Migration: 20260822123000_optimize_rls_performance.sql
-- ============================================================
-- Migration: 20260822123000_optimize_rls_performance.sql
-- Purpose: Optimize 272 RLS Performance & InitPlan Advisor Warnings:
--          1. Wraps auth.uid(), auth.jwt(), current_setting() in (SELECT ...) for InitPlan evaluation
--          2. Consolidates multiple permissive policies by separating SELECT from INSERT/UPDATE/DELETE
--          3. Targets authenticated role instead of PUBLIC to avoid redundant anon evaluation
-- ============================================================

BEGIN;

-- Some policy targets are only present in the consolidated schema. Keep this
-- optimization migration idempotent for a clean ordered database by applying
-- each policy only when its target relation exists.
create or replace function public._apply_optional_rls_policy(
  p_relation text,
  p_statement text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass(p_relation) is not null then
    execute p_statement;
  end if;
end;
$$;

revoke all on function public._apply_optional_rls_policy(text, text)
  from public, anon, authenticated;




-- Table: lead_stage_history
select public._apply_optional_rls_policy('public.lead_stage_history', $policy_sql$
DROP POLICY IF EXISTS "lead_stage_history_tenant_isolation" ON public.lead_stage_history;
$policy_sql$);
select public._apply_optional_rls_policy('public.lead_stage_history', $policy_sql$
CREATE POLICY "lead_stage_history_tenant_isolation" ON public.lead_stage_history
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- provider_events is created by the later multichannel inbound migration.
-- Its tenant policies are installed there so this migration can be applied
-- to a fresh database in timestamp order without referencing a missing table.

-- Table: idempotency_keys
select public._apply_optional_rls_policy('public.idempotency_keys', $policy_sql$
DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON public.idempotency_keys;
$policy_sql$);
select public._apply_optional_rls_policy('public.idempotency_keys', $policy_sql$
CREATE POLICY "idempotency_keys_tenant_isolation" ON public.idempotency_keys
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_sequences
select public._apply_optional_rls_policy('public.followup_sequences', $policy_sql$
DROP POLICY IF EXISTS "followup_sequences_tenant_isolation" ON public.followup_sequences;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_sequences', $policy_sql$
CREATE POLICY "followup_sequences_tenant_isolation" ON public.followup_sequences
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_steps
select public._apply_optional_rls_policy('public.followup_steps', $policy_sql$
DROP POLICY IF EXISTS "followup_steps_tenant_isolation" ON public.followup_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_steps', $policy_sql$
CREATE POLICY "followup_steps_tenant_isolation" ON public.followup_steps
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_enrollments
select public._apply_optional_rls_policy('public.followup_enrollments', $policy_sql$
DROP POLICY IF EXISTS "followup_enrollments_tenant_isolation" ON public.followup_enrollments;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_enrollments', $policy_sql$
CREATE POLICY "followup_enrollments_tenant_isolation" ON public.followup_enrollments
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_jobs
select public._apply_optional_rls_policy('public.followup_jobs', $policy_sql$
DROP POLICY IF EXISTS "followup_jobs_tenant_isolation" ON public.followup_jobs;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_jobs', $policy_sql$
CREATE POLICY "followup_jobs_tenant_isolation" ON public.followup_jobs
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- clinic_integrations is created by the later multichannel inbound
-- migration; see that migration for its tenant policies.

-- Table: contact_channels
select public._apply_optional_rls_policy('public.contact_channels', $policy_sql$
DROP POLICY IF EXISTS "contact_channels_tenant_isolation" ON public.contact_channels;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_channels', $policy_sql$
CREATE POLICY "contact_channels_tenant_isolation" ON public.contact_channels
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: communication_consents
select public._apply_optional_rls_policy('public.communication_consents', $policy_sql$
DROP POLICY IF EXISTS "communication_consents_tenant_isolation" ON public.communication_consents;
$policy_sql$);
select public._apply_optional_rls_policy('public.communication_consents', $policy_sql$
CREATE POLICY "communication_consents_tenant_isolation" ON public.communication_consents
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calls
select public._apply_optional_rls_policy('public.calls', $policy_sql$
DROP POLICY IF EXISTS "calls_tenant_isolation" ON public.calls;
$policy_sql$);
select public._apply_optional_rls_policy('public.calls', $policy_sql$
CREATE POLICY "calls_tenant_isolation" ON public.calls
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: call_events
select public._apply_optional_rls_policy('public.call_events', $policy_sql$
DROP POLICY IF EXISTS "call_events_tenant_isolation" ON public.call_events;
$policy_sql$);
select public._apply_optional_rls_policy('public.call_events', $policy_sql$
CREATE POLICY "call_events_tenant_isolation" ON public.call_events
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calendly_connections
select public._apply_optional_rls_policy('public.calendly_connections', $policy_sql$
DROP POLICY IF EXISTS "calendly_connections_tenant_isolation" ON public.calendly_connections;
$policy_sql$);
select public._apply_optional_rls_policy('public.calendly_connections', $policy_sql$
CREATE POLICY "calendly_connections_tenant_isolation" ON public.calendly_connections
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calendly_event_types
select public._apply_optional_rls_policy('public.calendly_event_types', $policy_sql$
DROP POLICY IF EXISTS "calendly_event_types_tenant_isolation" ON public.calendly_event_types;
$policy_sql$);
select public._apply_optional_rls_policy('public.calendly_event_types', $policy_sql$
CREATE POLICY "calendly_event_types_tenant_isolation" ON public.calendly_event_types
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: service_event_type_mappings
select public._apply_optional_rls_policy('public.service_event_type_mappings', $policy_sql$
DROP POLICY IF EXISTS "service_event_type_mappings_tenant_isolation" ON public.service_event_type_mappings;
$policy_sql$);
select public._apply_optional_rls_policy('public.service_event_type_mappings', $policy_sql$
CREATE POLICY "service_event_type_mappings_tenant_isolation" ON public.service_event_type_mappings
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: audit_logs
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
$policy_sql$);
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
  FOR SELECT TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;
$policy_sql$);
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: profiles
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_account_member(account_id)
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
$policy_sql$);

select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
$policy_sql$);

-- Table: hospital_followups
select public._apply_optional_rls_policy('public.hospital_followups', $policy_sql$
DROP POLICY IF EXISTS "Enable all operations for account members" ON public.hospital_followups;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_followups', $policy_sql$
CREATE POLICY "hospital_followups_member_isolation" ON public.hospital_followups
  FOR ALL TO authenticated
  USING (account_id IN (SELECT profiles.account_id FROM profiles WHERE profiles.user_id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT profiles.account_id FROM profiles WHERE profiles.user_id = (SELECT auth.uid())));
$policy_sql$);

-- Table: platform_payments
select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
DROP POLICY IF EXISTS "Tenant members can view own account payments" ON public.platform_payments;
$policy_sql$);
select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
DROP POLICY IF EXISTS "Service role and Super Admins manage platform payments" ON public.platform_payments;
$policy_sql$);

select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
CREATE POLICY "platform_payments_select" ON public.platform_payments
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = platform_payments.account_id AND account_members.user_id = (SELECT auth.uid()) AND account_members.active = true))
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
CREATE POLICY "platform_payments_modify" ON public.platform_payments
  FOR ALL TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role'::text)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  )
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role'::text)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  );
$policy_sql$);

-- Table: plans
select public._apply_optional_rls_policy('public.plans', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
$policy_sql$);
select public._apply_optional_rls_policy('public.plans', $policy_sql$
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_select" ON public.plans
  FOR SELECT TO authenticated
  USING (
    true
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_modify" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

-- Table: subscriptions
select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON public.subscriptions;
$policy_sql$);
select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
DROP POLICY IF EXISTS "Users can view their account subscription" ON public.subscriptions;
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_modify" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

-- Table: usage_tracking
select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage usage tracking" ON public.usage_tracking;
$policy_sql$);
select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
DROP POLICY IF EXISTS "Users can view their account usage" ON public.usage_tracking;
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_select" ON public.usage_tracking
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_modify" ON public.usage_tracking
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_update" ON public.usage_tracking
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_delete" ON public.usage_tracking
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);


-- ── 7. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES ON FEATURE TABLES ──

-- Table: account_invitations
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
DROP POLICY IF EXISTS "account_invitations_modify" ON public.account_invitations;
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
DROP POLICY IF EXISTS "account_invitations_select" ON public.account_invitations;
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_select" ON public.account_invitations
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_insert" ON public.account_invitations
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_update" ON public.account_invitations
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_delete" ON public.account_invitations
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: appointments
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage appointments" ON public.appointments;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
DROP POLICY IF EXISTS "Users can view appointments" ON public.appointments;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: appointments_feedback
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage feedback" ON public.appointments_feedback;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
DROP POLICY IF EXISTS "Users can view feedback" ON public.appointments_feedback;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_select" ON public.appointments_feedback
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_insert" ON public.appointments_feedback
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_update" ON public.appointments_feedback
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_delete" ON public.appointments_feedback
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: automation_steps
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
DROP POLICY IF EXISTS "automation_steps_modify" ON public.automation_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
DROP POLICY IF EXISTS "automation_steps_select" ON public.automation_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_select" ON public.automation_steps
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_insert" ON public.automation_steps
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_update" ON public.automation_steps
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_delete" ON public.automation_steps
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: billing_invoices
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage invoices" ON public.billing_invoices;
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
DROP POLICY IF EXISTS "Users can view invoices" ON public.billing_invoices;
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_select" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_insert" ON public.billing_invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_update" ON public.billing_invoices
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_delete" ON public.billing_invoices
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: broadcast_recipients
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
DROP POLICY IF EXISTS "broadcast_recipients_modify" ON public.broadcast_recipients;
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
DROP POLICY IF EXISTS "broadcast_recipients_select" ON public.broadcast_recipients;
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_select" ON public.broadcast_recipients
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_insert" ON public.broadcast_recipients
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_update" ON public.broadcast_recipients
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_delete" ON public.broadcast_recipients
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: coaching_admissions
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching admissions" ON public.coaching_admissions;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching admissions" ON public.coaching_admissions;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_select" ON public.coaching_admissions
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_insert" ON public.coaching_admissions
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_update" ON public.coaching_admissions
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_delete" ON public.coaching_admissions
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_batches
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching batches" ON public.coaching_batches;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching batches" ON public.coaching_batches;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_select" ON public.coaching_batches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_insert" ON public.coaching_batches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_update" ON public.coaching_batches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_delete" ON public.coaching_batches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_courses
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching courses" ON public.coaching_courses;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching courses" ON public.coaching_courses;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_select" ON public.coaching_courses
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_insert" ON public.coaching_courses
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_update" ON public.coaching_courses
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_delete" ON public.coaching_courses
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_students
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching students" ON public.coaching_students;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching students" ON public.coaching_students;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_select" ON public.coaching_students
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_insert" ON public.coaching_students
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_update" ON public.coaching_students
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_delete" ON public.coaching_students
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: contact_custom_values
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
DROP POLICY IF EXISTS "contact_custom_values_modify" ON public.contact_custom_values;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
DROP POLICY IF EXISTS "contact_custom_values_select" ON public.contact_custom_values;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_select" ON public.contact_custom_values
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_insert" ON public.contact_custom_values
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_update" ON public.contact_custom_values
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_delete" ON public.contact_custom_values
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: contact_tags
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
DROP POLICY IF EXISTS "contact_tags_modify" ON public.contact_tags;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
DROP POLICY IF EXISTS "contact_tags_select" ON public.contact_tags;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_select" ON public.contact_tags
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_insert" ON public.contact_tags
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_update" ON public.contact_tags
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_delete" ON public.contact_tags
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: flow_nodes
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
DROP POLICY IF EXISTS "flow_nodes_modify" ON public.flow_nodes;
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
DROP POLICY IF EXISTS "flow_nodes_select" ON public.flow_nodes;
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_select" ON public.flow_nodes
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_insert" ON public.flow_nodes
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_update" ON public.flow_nodes
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_delete" ON public.flow_nodes
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: hospital_bills
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage bills" ON public.hospital_bills;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
DROP POLICY IF EXISTS "Users can view bills" ON public.hospital_bills;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_select" ON public.hospital_bills
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_insert" ON public.hospital_bills
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_update" ON public.hospital_bills
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_delete" ON public.hospital_bills
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_branch_staff
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage branch staff" ON public.hospital_branch_staff;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
DROP POLICY IF EXISTS "Users can view branch staff" ON public.hospital_branch_staff;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_select" ON public.hospital_branch_staff
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_insert" ON public.hospital_branch_staff
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_update" ON public.hospital_branch_staff
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_delete" ON public.hospital_branch_staff
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_branches
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage hospital branches" ON public.hospital_branches;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
DROP POLICY IF EXISTS "Users can view hospital branches" ON public.hospital_branches;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_select" ON public.hospital_branches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_insert" ON public.hospital_branches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_update" ON public.hospital_branches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_delete" ON public.hospital_branches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_doctors
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage doctors" ON public.hospital_doctors;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
DROP POLICY IF EXISTS "Users can view doctors" ON public.hospital_doctors;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_select" ON public.hospital_doctors
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_insert" ON public.hospital_doctors
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_update" ON public.hospital_doctors
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_delete" ON public.hospital_doctors
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_insurance
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage insurance" ON public.hospital_insurance;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
DROP POLICY IF EXISTS "Users can view insurance" ON public.hospital_insurance;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_select" ON public.hospital_insurance
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_insert" ON public.hospital_insurance
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_update" ON public.hospital_insurance
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_delete" ON public.hospital_insurance
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_lab_reports
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Users can view reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_select" ON public.hospital_lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_insert" ON public.hospital_lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_update" ON public.hospital_lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_delete" ON public.hospital_lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: knowledge_base
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage knowledge base" ON public.knowledge_base;
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
DROP POLICY IF EXISTS "Users can read their account knowledge base" ON public.knowledge_base;
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_select" ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_insert" ON public.knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_update" ON public.knowledge_base
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_delete" ON public.knowledge_base
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: lab_reports
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage lab reports" ON public.lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Users can view lab reports" ON public.lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_select" ON public.lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_insert" ON public.lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_update" ON public.lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_delete" ON public.lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: message_reactions
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
DROP POLICY IF EXISTS "message_reactions_modify" ON public.message_reactions;
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_update" ON public.message_reactions
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: messages
select public._apply_optional_rls_policy('public.messages', $policy_sql$
DROP POLICY IF EXISTS "messages_modify" ON public.messages;
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
DROP POLICY IF EXISTS "messages_select" ON public.messages;
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: patients
select public._apply_optional_rls_policy('public.patients', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage patients" ON public.patients;
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
DROP POLICY IF EXISTS "Users can view patients" ON public.patients;
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_select" ON public.patients
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_insert" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_update" ON public.patients
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_delete" ON public.patients
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: pipeline_stages
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
DROP POLICY IF EXISTS "pipeline_stages_modify" ON public.pipeline_stages;
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);

-- Table: real_estate_properties
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage properties" ON public.real_estate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
DROP POLICY IF EXISTS "Users can view properties" ON public.real_estate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_select" ON public.real_estate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_insert" ON public.real_estate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_update" ON public.real_estate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_delete" ON public.real_estate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: real_estate_visits
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage visits" ON public.real_estate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
DROP POLICY IF EXISTS "Users can view visits" ON public.real_estate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_select" ON public.real_estate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_insert" ON public.real_estate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_update" ON public.real_estate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_delete" ON public.real_estate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: realestate_agents
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage realestate agents" ON public.realestate_agents;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
DROP POLICY IF EXISTS "Users can view realestate agents" ON public.realestate_agents;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_select" ON public.realestate_agents
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_insert" ON public.realestate_agents
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_update" ON public.realestate_agents
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_delete" ON public.realestate_agents
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: realestate_leads
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage realestate leads" ON public.realestate_leads;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
DROP POLICY IF EXISTS "Users can view realestate leads" ON public.realestate_leads;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_select" ON public.realestate_leads
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_insert" ON public.realestate_leads
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_update" ON public.realestate_leads
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_delete" ON public.realestate_leads
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: realestate_properties
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage properties" ON public.realestate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
DROP POLICY IF EXISTS "Users can view properties" ON public.realestate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_select" ON public.realestate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_insert" ON public.realestate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_update" ON public.realestate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_delete" ON public.realestate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: realestate_visits
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage site visits" ON public.realestate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
DROP POLICY IF EXISTS "Users can view site visits" ON public.realestate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_select" ON public.realestate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_insert" ON public.realestate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_update" ON public.realestate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_delete" ON public.realestate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: tenant_modules
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage tenant modules" ON public.tenant_modules;
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
DROP POLICY IF EXISTS "Users can view tenant modules" ON public.tenant_modules;
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_select" ON public.tenant_modules
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_insert" ON public.tenant_modules
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_update" ON public.tenant_modules
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_delete" ON public.tenant_modules
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: travel_bookings
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage travel bookings" ON public.travel_bookings;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
DROP POLICY IF EXISTS "Users can view travel bookings" ON public.travel_bookings;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_select" ON public.travel_bookings
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_insert" ON public.travel_bookings
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_update" ON public.travel_bookings
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_delete" ON public.travel_bookings
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: travel_packages
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage travel packages" ON public.travel_packages;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
DROP POLICY IF EXISTS "Users can view travel packages" ON public.travel_packages;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_select" ON public.travel_packages
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_insert" ON public.travel_packages
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_update" ON public.travel_packages
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_delete" ON public.travel_packages
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);


drop function public._apply_optional_rls_policy(text, text);

COMMIT;


-- Migration: 20260822124500_add_missing_rls_policies.sql
-- ============================================================
-- Migration: 20260822124500_add_missing_rls_policies.sql
-- Purpose: Add RLS tenant policies for automation_pending_executions,
--          inbound_webhook_events, and outbound_outbox to resolve
--          rls_enabled_no_policy advisors.
-- ============================================================

begin;

-- These tables are present in the consolidated/legacy schema, but are not
-- created by the ordered migration directory. Apply the hardening when a
-- deployment already has a table, while allowing a clean ordered database to
-- continue to the migrations that provision the inbound tables later.
do $$
begin
  if to_regclass('public.automation_pending_executions') is not null then
    execute $automation$
      alter table public.automation_pending_executions enable row level security;
      drop policy if exists "automation_pending_executions_select" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_insert" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_update" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_delete" on public.automation_pending_executions;

      create policy "automation_pending_executions_select" on public.automation_pending_executions
        for select to authenticated
        using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_insert" on public.automation_pending_executions
        for insert to authenticated, service_role
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_update" on public.automation_pending_executions
        for update to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role')
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_delete" on public.automation_pending_executions
        for delete to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');
    $automation$;
  end if;

  if to_regclass('public.outbound_outbox') is not null then
    execute $outbox$
      alter table public.outbound_outbox enable row level security;
      drop policy if exists "outbound_outbox_select" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_insert" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_update" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_delete" on public.outbound_outbox;

      create policy "outbound_outbox_select" on public.outbound_outbox
        for select to authenticated
        using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_insert" on public.outbound_outbox
        for insert to authenticated, service_role
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_update" on public.outbound_outbox
        for update to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role')
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_delete" on public.outbound_outbox
        for delete to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');
    $outbox$;
  end if;
end $$;

commit;


-- Migration: 20260822130000_restore_rls_authorization_invariants.sql
-- Restore authorization invariants after the broad function and RLS advisor migrations.
-- This migration is intentionally narrow: only policy helper functions regain
-- authenticated execution, and platform administration remains persisted-role-only.
begin;

-- RLS evaluates these security-definer helpers for authenticated requests.
-- Grant every existing overload by catalog identity so this remains idempotent
-- across environments with slightly different migration histories.
do $$
declare
  helper regprocedure;
begin
  for helper in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_active_account_member',
        'has_account_role',
        'is_account_member',
        'is_platform_super_admin'
      )
  loop
    execute format(
      'grant execute on function %s to authenticated',
      helper
    );
  end loop;
end $$;

-- Remove both legacy and advisor-generated policy names before rebuilding the
-- effective policies. Email identity is deliberately not an authorization path.
drop policy if exists "Tenant members can view own account payments"
  on public.platform_payments;
drop policy if exists "Service role and Super Admins manage platform payments"
  on public.platform_payments;
drop policy if exists "platform_payments_select"
  on public.platform_payments;
drop policy if exists "platform_payments_modify"
  on public.platform_payments;

create policy "platform_payments_select"
  on public.platform_payments
  for select
  to authenticated
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

create policy "platform_payments_modify"
  on public.platform_payments
  for all
  to authenticated, service_role
  using (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  )
  with check (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  );

commit;


-- Migration: 20260822131500_product_outcome_events.sql
-- Privacy-safe, versioned source events for independently verifiable product outcomes.
-- This migration creates the measurement foundation only; it does not publish
-- results or claim that a complete observation window exists.
begin;

create table if not exists public.product_outcome_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'inbound_message_received',
      'first_response_sent',
      'booking_confirmed',
      'automation_eligible',
      'automation_completed',
      'staff_takeover',
      'automation_error',
      'appointment_completed',
      'patient_return_completed'
    )
  ),
  event_version smallint not null default 1 check (event_version = 1),
  occurred_at timestamptz not null,
  source_id text not null check (length(source_id) between 16 and 200),
  subject_hash text check (
    subject_hash is null or subject_hash ~ '^[a-f0-9]{64}$'
  ),
  is_synthetic boolean not null default false,
  is_test_tenant boolean not null default false,
  attributes jsonb not null default '{}'::jsonb check (
    jsonb_typeof(attributes) = 'object'
    and not (
      attributes ?| array[
        'name',
        'patient_name',
        'patient_id',
        'phone',
        'phone_number',
        'email',
        'message',
        'message_body'
      ]
    )
  ),
  recorded_at timestamptz not null default now(),
  unique (account_id, event_name, event_version, source_id)
);

comment on table public.product_outcome_events is
  'Versioned, de-identified source events for audited product outcome calculations.';
comment on column public.product_outcome_events.source_id is
  'Opaque idempotency identifier; must not contain patient data.';
comment on column public.product_outcome_events.subject_hash is
  'Optional one-way HMAC/sha256 identity used only for cohort deduplication.';

create index if not exists product_outcome_events_account_window_idx
  on public.product_outcome_events (account_id, occurred_at desc)
  where is_synthetic = false and is_test_tenant = false;

create index if not exists product_outcome_events_metric_window_idx
  on public.product_outcome_events (event_name, occurred_at desc)
  where is_synthetic = false and is_test_tenant = false;

alter table public.product_outcome_events enable row level security;
alter table public.product_outcome_events force row level security;

revoke all on table public.product_outcome_events from public, anon, authenticated;
grant select, insert on table public.product_outcome_events to service_role;

-- No client-facing policy is intentional. Collection and reporting run only in
-- trusted server jobs, and public reporting requires a separately reviewed,
-- aggregate-only publication path.
drop policy if exists "service_role_collects_product_outcomes"
  on public.product_outcome_events;
create policy "service_role_collects_product_outcomes"
  on public.product_outcome_events
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

commit;


-- Migration: 20260822140000_harden_storage_and_invoker_functions.sql
-- ============================================================
-- Migration: 20260822140000_harden_storage_and_invoker_functions.sql
-- Purpose: Fix remaining security advisors:
--          1. Converts helper functions to SECURITY INVOKER
--          2. Scopes public storage bucket SELECT policies to prevent unauthorized file listing
-- ============================================================

begin;

-- 1. Helper functions as SECURITY INVOKER
create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and is_super_admin = true
  );
$$;

create or replace function public.is_active_account_member(target_account_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account_id and user_id = (select auth.uid()) and active
  );
$$;

create or replace function public.is_account_member(target_account_id uuid, min_role account_role_enum default 'viewer'::account_role_enum)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from profiles p
    where p.user_id = (select auth.uid())
      and p.account_id = target_account_id
      and case p.account_role
            when 'owner'  then 4
            when 'admin'  then 3
            when 'agent'  then 2
            when 'viewer' then 1
          end
        >=
          case min_role
            when 'owner'  then 4
            when 'admin'  then 3
            when 'agent'  then 2
            when 'viewer' then 1
          end
  );
$$;

-- 2. Public storage bucket listing policies
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Chat media is publicly readable" on storage.objects;
drop policy if exists "Flow media is publicly readable" on storage.objects;

drop policy if exists "Users can read their own avatars" on storage.objects;
create policy "Users can read their own avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Members can read chat media" on storage.objects;
create policy "Members can read chat media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from profiles p
      where p.user_id = (select auth.uid())
        and ('account-' || p.account_id::text) = (storage.foldername(objects.name))[1]
    )
  );

drop policy if exists "Members can read flow media" on storage.objects;
create policy "Members can read flow media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'flow-media'
    and (
      exists (
        select 1 from profiles p
        where p.user_id = (select auth.uid())
          and ('account-' || p.account_id::text) = (storage.foldername(objects.name))[1]
      )
      or (select auth.uid())::text = (storage.foldername(name))[1]
    )
  );

commit;


-- Migration: 20260822150000_sales_crm_complete_schema.sql
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
  -- 1. Check account existence
  if not exists (select 1 from public.accounts where id = p_account_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 2. Verify authorization: caller or specified user must have agent role on this account
  if p_user_id is not null then
    if not exists (
      select 1 from public.account_members
      where account_id = p_account_id
        and user_id = p_user_id
        and role in ('owner', 'admin', 'agent')
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: User is not an authorized agent for this account.' using errcode = '42501';
    end if;
  elsif not (is_account_member(p_account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role') then
    raise exception 'INSUFFICIENT_PERMISSIONS: Agent role required.' using errcode = '42501';
  end if;

  -- 3. Lock quotation FOR UPDATE to prevent race conditions
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

  -- 4. Concurrency-safe invoice number generation
  v_inv_number := generate_next_invoice_number(p_account_id);
  v_due_date := current_date + interval '14 days';

  -- 5. Insert Invoice
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

  -- 6. Copy all line items
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

  -- 7. Update Quotation status to accepted & converted
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
  -- 1. Check account existence
  if not exists (select 1 from public.accounts where id = p_account_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 2. Verify authorization: caller or specified user must have agent role on this account
  if p_user_id is not null then
    if not exists (
      select 1 from public.account_members
      where account_id = p_account_id
        and user_id = p_user_id
        and role in ('owner', 'admin', 'agent')
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: User is not an authorized agent for this account.' using errcode = '42501';
    end if;
  elsif not (is_account_member(p_account_id, 'agent'::account_role_enum) or (select auth.role()) = 'service_role') then
    raise exception 'INSUFFICIENT_PERMISSIONS: Agent role required.' using errcode = '42501';
  end if;

  -- 3. Validate payment amount
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: Payment amount must be positive.' using errcode = '22003';
  end if;

  -- 4. Lock invoice FOR UPDATE
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

  -- 5. Record payment
  insert into public.invoice_payments (
    account_id,
    invoice_id,
    amount,
    currency,
    payment_date,
    payment_method,
    reference_note,
    created_by
  ) values (
    p_account_id,
    p_invoice_id,
    p_amount,
    v_inv.currency,
    current_date,
    coalesce(p_payment_method, 'cash'),
    p_reference_note,
    p_user_id
  ) returning id into v_payment_id;

  -- 6. Recalculate amounts
  v_new_paid := v_inv.amount_paid + p_amount;
  v_new_balance := greatest(0, v_inv.total - v_new_paid);

  if v_new_balance = 0 or v_new_paid >= v_inv.total then
    v_new_status := 'paid';
  else
    v_new_status := 'partially_paid';
  end if;

  -- 7. Update invoice
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

-- ============================================================
-- SECTION 7: RPC SECURITY GRANTS
-- ============================================================
revoke all on function public.generate_next_quotation_number(uuid) from public;
revoke all on function public.generate_next_quotation_number(uuid) from authenticated;
grant execute on function public.generate_next_quotation_number(uuid) to service_role;

revoke all on function public.generate_next_invoice_number(uuid) from public;
revoke all on function public.generate_next_invoice_number(uuid) from authenticated;
grant execute on function public.generate_next_invoice_number(uuid) to service_role;

revoke all on function public.convert_quotation_to_invoice(uuid, uuid, uuid) from public;
revoke all on function public.convert_quotation_to_invoice(uuid, uuid, uuid) from authenticated;
grant execute on function public.convert_quotation_to_invoice(uuid, uuid, uuid) to service_role;

revoke all on function public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid) from public;
revoke all on function public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid) from authenticated;
grant execute on function public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid) to service_role;

commit;


-- Migration: 20260822160000_automation_ai_module.sql
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-08-23.
-- This historical migration is already applied in production; do not reapply it there.

-- Migration: Automation & AI module — tenant chatbot controls
--
-- Purpose: the Automation & AI section needs an account-level master switch for
-- the WhatsApp AI chatbot, a response-style preference, and human-handoff
-- configuration. Before this migration the only AI on/off state was
-- per-conversation (`conversations.is_ai_enabled` / `ai_chat_enabled`), so a
-- tenant could not pause the receptionist for the whole workspace.
--
-- Design notes:
--   * No new table. These are per-tenant preferences on an existing tenant row,
--     so they live on `public.accounts` alongside `ai_system_prompt` and
--     `welcome_message`, which the AI pipeline already reads the same way.
--   * `accounts` already has RLS and account-scoped policies, so no new policy
--     is required and no cross-tenant surface is introduced.
--   * Idempotent (`add column if not exists`) so it is safe to re-run against
--     an environment that already has the columns.

begin;

alter table public.accounts
  add column if not exists ai_chatbot_enabled boolean not null default true;

alter table public.accounts
  add column if not exists ai_response_style text not null default 'friendly';

alter table public.accounts
  add column if not exists ai_handoff_enabled boolean not null default true;

-- Which real, backend-detectable signals should escalate to a human.
-- `human_request` maps to the explicit "talk to a person" detection in
-- src/core/ai/engine.ts + src/lib/whatsapp/ai.ts. `complaint` maps to the
-- structured `intent === 'complaint'` classification the reply pipeline
-- already produces. Only signals the engine can actually observe are stored.
alter table public.accounts
  add column if not exists ai_handoff_triggers jsonb not null
    default '{"human_request": true, "complaint": true}'::jsonb;

-- Constrain response style to the values the prompt builder understands, so a
-- bad write can never inject arbitrary text into the system prompt.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_ai_response_style_check'
  ) then
    alter table public.accounts
      add constraint accounts_ai_response_style_check
      check (ai_response_style in ('professional', 'friendly', 'concise'));
  end if;
end $$;

commit;


-- Migration: 20260823120000_marketing_module.sql
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


-- Migration: 20260823130000_fix_inbound_message_pipeline.sql
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

-- Older deployments created this ledger before tenant attribution was added
-- (the legacy 062/063 shape). Reconcile that shape before creating any
-- account-scoped indexes or policies; otherwise this migration fails at
-- `inbound_webhook_events_account_status_idx` and the original 500-path
-- remains in production.
alter table public.inbound_webhook_events
  add column if not exists account_id uuid;

alter table public.inbound_webhook_events
  add column if not exists entry_id text;

alter table public.inbound_webhook_events
  add column if not exists field text not null default 'messages';

alter table public.inbound_webhook_events
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.inbound_webhook_events
  add column if not exists status text not null default 'received';

alter table public.inbound_webhook_events
  add column if not exists retry_count integer not null default 0;

alter table public.inbound_webhook_events
  add column if not exists error_log text;

alter table public.inbound_webhook_events
  add column if not exists processed_at timestamptz;

alter table public.inbound_webhook_events
  add column if not exists created_at timestamptz not null default now();

alter table public.inbound_webhook_events
  add column if not exists updated_at timestamptz not null default now();

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

-- Raw webhook payloads contain PHI/PII. Keep this bookkeeping table
-- service-role-only, matching the legacy security migration; tenant users do
-- not need direct access to the provider payload ledger.
revoke all on table public.inbound_webhook_events from anon, authenticated;
grant all on table public.inbound_webhook_events to service_role;

-- Mirrors the policy set already declared in
-- 20260822124500_add_missing_rls_policies.sql so that migration remains
-- satisfied whichever order the two are applied in.
drop policy if exists "inbound_webhook_events_select" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_insert" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_update" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_delete" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_service_select" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_service_insert" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_service_update" on public.inbound_webhook_events;
drop policy if exists "inbound_webhook_events_service_delete" on public.inbound_webhook_events;

create policy "inbound_webhook_events_service_select" on public.inbound_webhook_events
  for select to service_role
  using ((select auth.role()) = 'service_role');

create policy "inbound_webhook_events_service_insert" on public.inbound_webhook_events
  for insert to service_role
  with check ((select auth.role()) = 'service_role');

create policy "inbound_webhook_events_service_update" on public.inbound_webhook_events
  for update to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "inbound_webhook_events_service_delete" on public.inbound_webhook_events
  for delete to service_role
  using ((select auth.role()) = 'service_role');


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

-- Marker used by compatibility rollup paths to make a retry repair-safe.
-- It is intentionally nullable so legacy rows remain untouched.
alter table public.messages
  add column if not exists inbound_rollup_applied_at timestamptz;


-- ────────────────────────────────────────────────────────────
-- 4. Duplicate-proofing on messages.message_id
--
--    `messages_provider_message_unique (account_id, provider_message_id)`
--    already exists, but inbound rows historically left
--    provider_message_id NULL so the index never applied to them. The
--    inbound path now populates both columns; this account-scoped partial
--    index closes the remaining gap for rows written by older code paths and
--    gives the webhook a hard, race-free duplicate guard without treating a
--    WAHA/Twilio ID that is valid in another workspace as this workspace's
--    duplicate.
--
--    Wrapped in an exception handler: a database that already accumulated
--    duplicate rows (the very defect being fixed) would otherwise abort
--    the whole migration. We report and continue rather than blocking the
--    fix that stops new duplicates from being created.
-- ────────────────────────────────────────────────────────────
do $$
begin
  -- A previous draft created a global message_id index. Remove it before
  -- installing the tenant-scoped form; otherwise provider IDs that are only
  -- unique within a session/workspace can be rejected across tenants.
  drop index if exists public.messages_message_id_unique;
  create unique index if not exists messages_message_id_unique
    on public.messages (account_id, message_id)
    where account_id is not null and message_id is not null;
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
  p_message_at timestamptz,
  p_message_key text
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
  with claimed as (
    update public.messages m
    set inbound_rollup_applied_at = now()
    where p_message_key is not null
      and m.conversation_id = p_conversation_id
      and (m.id::text = p_message_key or m.message_id = p_message_key or m.provider_message_id = p_message_key)
      and m.inbound_rollup_applied_at is null
    returning m.id
  ), should_apply as (
    select p_message_key is null or exists (select 1 from claimed) as apply
  )
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
    unread_count = coalesce(c.unread_count, 0) +
      case when (select apply from should_apply) then 1 else 0 end,
    -- A customer replying to a closed thread reopens it.
    status = case when c.status = 'closed' then 'open' else c.status end,
    updated_at = now()
  where c.id = p_conversation_id
  returning c.id, c.unread_count, c.status, c.last_message_at;
$$;

-- Keep the original three-argument RPC signature for older callers and for
-- PostgREST function discovery. A default argument on the four-argument
-- overload does not create a three-argument function, and GRANT/REVOKE on a
-- non-existent signature aborts a fresh migration.
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
  select * from public.apply_inbound_message_to_conversation(
    p_conversation_id,
    p_preview,
    p_message_at,
    null::text
  );
$$;

revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from anon;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from authenticated;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) from public;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz, text) from anon;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz, text) from authenticated;
revoke execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz, text) from public;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) to service_role;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz) to postgres;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz, text) to service_role;
grant execute on function
  public.apply_inbound_message_to_conversation(uuid, text, timestamptz, text) to postgres;


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


-- Migration: 20260823140000_multichannel_inbound_support.sql
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


-- Migration: 20260825100000_automation_workflow_seed_metadata.sql
begin;

alter table public.automations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_automations_seed_metadata
  on public.automations ((metadata ->> 'workflow_seed_key'))
  where (metadata ->> 'helpa_seeded_workflow') = 'true';

commit;
