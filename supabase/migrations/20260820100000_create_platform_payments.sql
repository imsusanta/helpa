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

-- ── PLANS & SUBSCRIPTIONS (SAAS MULTI-TENANT CORE) ────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status_enum') then
    create type subscription_status_enum as enum ('trial', 'active', 'expired', 'cancelled');
  end if;
end $$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_price integer not null default 0,
  yearly_price integer not null default 0,
  max_users integer not null default 5,
  max_contacts integer not null default 500,
  max_whatsapp_numbers integer not null default 1,
  max_ai_requests integer not null default 100,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade unique,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status subscription_status_enum not null default 'trial',
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_account on public.subscriptions (account_id);

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  category text not null check (category in ('faq', 'service', 'pricing', 'policy', 'company')),
  question_title text not null,
  answer_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kb_account_category on public.knowledge_base (account_id, category);

create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  month date not null default date_trunc('month', current_date)::date,
  ai_requests integer not null default 0,
  ai_tokens integer not null default 0,
  whatsapp_messages integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, month)
);
create index if not exists idx_usage_tracking_account_month on public.usage_tracking (account_id, month);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.usage_tracking enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_select') then
    create policy plans_select on public.plans for select to authenticated, anon using (auth.role() in ('authenticated', 'anon', 'service_role'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select') then
    create policy subscriptions_select on public.subscriptions for select to authenticated using (public.is_active_account_member(account_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'knowledge_base' and policyname = 'knowledge_base_select') then
    create policy knowledge_base_select on public.knowledge_base for select to authenticated using (public.is_active_account_member(account_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'knowledge_base' and policyname = 'knowledge_base_all') then
    create policy knowledge_base_all on public.knowledge_base for all to authenticated using (public.has_account_role(account_id, 'agent')) with check (public.has_account_role(account_id, 'agent'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_tracking' and policyname = 'usage_tracking_select') then
    create policy usage_tracking_select on public.usage_tracking for select to authenticated using (public.is_active_account_member(account_id));
  end if;
end $$;

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

alter table public.profiles add column if not exists is_super_admin boolean not null default false;

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
