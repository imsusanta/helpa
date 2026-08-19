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
