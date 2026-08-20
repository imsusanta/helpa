-- ============================================================
-- Migration: 20260820100000_create_platform_payments.sql
-- Purpose: Permanent, idempotent financial transaction storage for SaaS subscriptions & renewals.
-- ============================================================

begin;

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

-- Indexes for fast query performance and tenant isolation
create index if not exists idx_platform_payments_account_id on public.platform_payments(account_id);
create index if not exists idx_platform_payments_created_at on public.platform_payments(created_at desc);
create index if not exists idx_platform_payments_status on public.platform_payments(status);

-- Enable Row Level Security (RLS)
alter table public.platform_payments enable row level security;

-- 1. Tenant users can read their own organization's payment receipts & history
create policy "Tenant members can view own account payments"
  on public.platform_payments
  for select
  using (
    public.is_active_account_member(account_id)
    or exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
      and (profiles.is_super_admin = true or profiles.email = 'susantalohr@gmail.com')
    )
  );

-- 2. Only trusted server-side Service Role and Super Admins can write payment records
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
