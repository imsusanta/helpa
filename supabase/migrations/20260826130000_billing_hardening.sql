-- ============================================================
-- Migration: 20260826130000_billing_hardening.sql
-- Purpose: Fail-closed SaaS billing.
--   1. Canonical public.subscriptions schema (created if the deployment
--      predates it; columns added if missing), one row per account,
--      normalized uppercase statuses with a CHECK constraint.
--   2. public.billing_orders: server-created order records the Razorpay
--      webhook verifies amount/currency/plan/account against.
--   3. platform_payments RLS without the hard-coded email backdoor;
--      super-admin access uses public.is_platform_super_admin().
--   4. Atomic, idempotent payment RPCs (billing_apply_payment_captured /
--      billing_apply_payment_failed) that lock state, verify the payment
--      was not processed, update the subscription, write the ledger and
--      audit log, and mirror accounts.* — all in one transaction.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Canonical subscriptions table
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  plan_slug text,
  status text not null default 'PENDING_PAYMENT',
  setup_fee_paid boolean not null default false,
  setup_fee_amount numeric(12, 2) not null default 0,
  monthly_amount numeric(12, 2) not null default 0,
  currency text not null default 'INR',
  billing_interval text not null default 'monthly',
  start_date timestamptz,
  end_date timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  grace_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  payment_provider text,
  external_subscription_id text,
  was_upgraded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deployments that already had the table get any missing lifecycle columns.
alter table public.subscriptions add column if not exists plan_slug text;
alter table public.subscriptions add column if not exists status text not null default 'PENDING_PAYMENT';
alter table public.subscriptions add column if not exists setup_fee_paid boolean not null default false;
alter table public.subscriptions add column if not exists setup_fee_amount numeric(12, 2) not null default 0;
alter table public.subscriptions add column if not exists monthly_amount numeric(12, 2) not null default 0;
alter table public.subscriptions add column if not exists currency text not null default 'INR';
alter table public.subscriptions add column if not exists billing_interval text not null default 'monthly';
alter table public.subscriptions add column if not exists end_date timestamptz;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists trial_start timestamptz;
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists grace_period_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists cancelled_at timestamptz;
alter table public.subscriptions add column if not exists payment_provider text;
alter table public.subscriptions add column if not exists external_subscription_id text;
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

-- A missing subscription must never default to paid.
alter table public.subscriptions alter column setup_fee_paid set default false;
alter table public.subscriptions alter column status set default 'PENDING_PAYMENT';

-- Normalize legacy status casing/aliases before constraining.
update public.subscriptions set status = upper(coalesce(status, 'PENDING_PAYMENT'));
update public.subscriptions set status = 'TRIALING' where status = 'TRIAL';

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in (
    'PENDING_PAYMENT', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED',
    'CANCELLED', 'EXPIRED', 'INCOMPLETE', 'TRIAL_EXPIRED'
  ));

alter table public.subscriptions drop constraint if exists subscriptions_billing_interval_check;
alter table public.subscriptions add constraint subscriptions_billing_interval_check
  check (billing_interval in ('monthly', 'yearly'));

alter table public.subscriptions drop constraint if exists subscriptions_amounts_check;
alter table public.subscriptions add constraint subscriptions_amounts_check
  check (setup_fee_amount >= 0 and monthly_amount >= 0);

-- One current subscription per account: keep the newest row, then enforce.
delete from public.subscriptions s
where exists (
  select 1
  from public.subscriptions n
  where n.account_id = s.account_id
    and n.id <> s.id
    and (coalesce(n.updated_at, n.created_at, now()), n.id)
      > (coalesce(s.updated_at, s.created_at, now()), s.id)
);

create unique index if not exists subscriptions_account_unique
  on public.subscriptions (account_id);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_member_select on public.subscriptions;
create policy subscriptions_member_select
  on public.subscriptions for select to authenticated
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write
  on public.subscriptions for all to authenticated
  using (public.is_platform_super_admin())
  with check (public.is_platform_super_admin());

grant all on table public.subscriptions to service_role;

-- ------------------------------------------------------------
-- 2. Server-created payment orders
-- ------------------------------------------------------------
create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  razorpay_order_id text not null,
  plan_slug text not null check (plan_slug in ('starter', 'growth', 'pro', 'custom')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000),
  currency text not null default 'INR' check (char_length(currency) = 3),
  setup_fee_included boolean not null default false,
  setup_fee_amount numeric(12, 2) not null default 0 check (setup_fee_amount >= 0),
  monthly_amount numeric(12, 2) not null default 0 check (monthly_amount >= 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'abandoned')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_billing_orders_order_id unique (razorpay_order_id)
);

create index if not exists idx_billing_orders_account on public.billing_orders (account_id, created_at desc);

alter table public.billing_orders enable row level security;

drop policy if exists billing_orders_member_select on public.billing_orders;
create policy billing_orders_member_select
  on public.billing_orders for select to authenticated
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

-- Mutations happen only through trusted server code (service_role bypasses
-- RLS); authenticated clients get no insert/update/delete policy.
grant all on table public.billing_orders to service_role;

-- ------------------------------------------------------------
-- 3. platform_payments RLS without the email backdoor
-- ------------------------------------------------------------
drop policy if exists "Tenant members can view own account payments" on public.platform_payments;
create policy "Tenant members can view own account payments"
  on public.platform_payments
  for select
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

drop policy if exists "Service role and Super Admins manage platform payments" on public.platform_payments;
create policy "Service role and Super Admins manage platform payments"
  on public.platform_payments
  for all
  using (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  )
  with check (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  );

-- ------------------------------------------------------------
-- 4. Atomic payment RPCs (service_role only)
-- ------------------------------------------------------------
create or replace function public.billing_apply_payment_captured(
  p_account_id uuid,
  p_order_id text,
  p_payment_id text,
  p_plan_slug text,
  p_amount_paise bigint,
  p_currency text,
  p_setup_fee_included boolean,
  p_setup_fee_amount numeric,
  p_monthly_amount numeric,
  p_billing_interval text,
  p_signature text,
  p_event text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment record;
  v_sub record;
  v_now timestamptz := now();
  v_base timestamptz;
  v_new_end timestamptz;
  v_sub_id uuid;
  v_amount numeric := round(p_amount_paise / 100.0, 2);
  v_payment_type text;
begin
  if p_account_id is null
     or coalesce(p_payment_id, '') = ''
     or coalesce(p_order_id, '') = '' then
    raise exception 'billing_apply_payment_captured: missing payment identity';
  end if;

  -- Serialize concurrent webhook deliveries for the same account.
  perform pg_advisory_xact_lock(
    hashtextextended('billing:' || p_account_id::text, 0)
  );

  select id, status into v_payment
  from public.platform_payments
  where razorpay_payment_id = p_payment_id
  for update;

  if v_payment.id is not null and v_payment.status = 'captured' then
    -- Retry of an already-committed payment: never extend twice.
    return jsonb_build_object('status', 'already_processed');
  end if;

  select * into v_sub
  from public.subscriptions
  where account_id = p_account_id
  for update;

  v_base := greatest(v_now, coalesce(v_sub.end_date, v_now));
  if p_billing_interval = 'yearly' then
    v_new_end := v_base + interval '1 year';
  else
    v_new_end := v_base + interval '1 month';
  end if;

  v_payment_type := case
    when p_setup_fee_included then 'setup_and_first_month'
    else 'monthly_renewal'
  end;

  if v_sub.id is not null then
    update public.subscriptions set
      plan_slug = p_plan_slug,
      status = 'ACTIVE',
      setup_fee_paid = true,
      setup_fee_amount = coalesce(p_setup_fee_amount, setup_fee_amount),
      monthly_amount = coalesce(p_monthly_amount, monthly_amount),
      currency = coalesce(p_currency, currency),
      billing_interval = coalesce(p_billing_interval, billing_interval),
      current_period_start = v_now,
      current_period_end = v_new_end,
      end_date = v_new_end,
      grace_period_end = null,
      payment_provider = 'razorpay',
      external_subscription_id = p_payment_id,
      updated_at = v_now
    where id = v_sub.id
    returning id into v_sub_id;
  else
    insert into public.subscriptions (
      account_id, plan_slug, status, setup_fee_paid, setup_fee_amount,
      monthly_amount, currency, billing_interval,
      current_period_start, current_period_end, end_date,
      payment_provider, external_subscription_id, created_at, updated_at
    ) values (
      p_account_id, p_plan_slug, 'ACTIVE', true, coalesce(p_setup_fee_amount, 0),
      coalesce(p_monthly_amount, 0), coalesce(p_currency, 'INR'),
      coalesce(p_billing_interval, 'monthly'),
      v_now, v_new_end, v_new_end,
      'razorpay', p_payment_id, v_now, v_now
    )
    returning id into v_sub_id;
  end if;

  -- Ledger row keyed by the unique payment id; a prior row for the same
  -- order (e.g. an earlier failed attempt) is updated instead of violating
  -- the unique order-id constraint.
  if v_payment.id is not null then
    update public.platform_payments set
      subscription_id = v_sub_id,
      razorpay_order_id = p_order_id,
      razorpay_signature = p_signature,
      amount = v_amount,
      currency = coalesce(p_currency, 'INR'),
      plan_slug = p_plan_slug,
      payment_type = v_payment_type,
      status = 'captured',
      is_setup_fee_included = p_setup_fee_included,
      setup_fee_amount = coalesce(p_setup_fee_amount, 0),
      monthly_recurring_amount = coalesce(p_monthly_amount, 0),
      period_start = v_now,
      period_end = v_new_end,
      metadata = jsonb_build_object('gateway', 'razorpay', 'event', p_event),
      updated_at = v_now
    where id = v_payment.id;
  elsif exists (
    select 1 from public.platform_payments where razorpay_order_id = p_order_id
  ) then
    update public.platform_payments set
      subscription_id = v_sub_id,
      razorpay_payment_id = p_payment_id,
      razorpay_signature = p_signature,
      amount = v_amount,
      currency = coalesce(p_currency, 'INR'),
      plan_slug = p_plan_slug,
      payment_type = v_payment_type,
      status = 'captured',
      is_setup_fee_included = p_setup_fee_included,
      setup_fee_amount = coalesce(p_setup_fee_amount, 0),
      monthly_recurring_amount = coalesce(p_monthly_amount, 0),
      period_start = v_now,
      period_end = v_new_end,
      metadata = jsonb_build_object('gateway', 'razorpay', 'event', p_event),
      updated_at = v_now
    where razorpay_order_id = p_order_id;
  else
    insert into public.platform_payments (
      account_id, subscription_id, razorpay_order_id, razorpay_payment_id,
      razorpay_signature, amount, currency, plan_slug, payment_type, status,
      is_setup_fee_included, setup_fee_amount, monthly_recurring_amount,
      period_start, period_end, metadata
    ) values (
      p_account_id, v_sub_id, p_order_id, p_payment_id,
      p_signature, v_amount, coalesce(p_currency, 'INR'), p_plan_slug,
      v_payment_type, 'captured',
      p_setup_fee_included, coalesce(p_setup_fee_amount, 0), coalesce(p_monthly_amount, 0),
      v_now, v_new_end,
      jsonb_build_object('gateway', 'razorpay', 'event', p_event)
    );
  end if;

  update public.billing_orders
  set status = 'paid', updated_at = v_now
  where razorpay_order_id = p_order_id;

  insert into public.audit_logs (account_id, action, target_type, target_id, metadata)
  values (
    p_account_id, 'billing.payment_captured', 'subscription', v_sub_id,
    jsonb_build_object(
      'gateway', 'razorpay',
      'razorpay_payment_id', p_payment_id,
      'razorpay_order_id', p_order_id,
      'amount_paise', p_amount_paise,
      'currency', p_currency,
      'plan_slug', p_plan_slug,
      'payment_type', v_payment_type,
      'new_period_end', v_new_end
    )
  );

  -- Read-compat mirror inside the same transaction; older deployments
  -- without these columns skip the mirror rather than failing the payment.
  begin
    update public.accounts
    set subscription_plan = 'plan_' || p_plan_slug,
        subscription_status = 'ACTIVE',
        updated_at = v_now
    where id = p_account_id;
  exception when undefined_column then
    null;
  end;

  return jsonb_build_object(
    'status', 'processed',
    'subscription_id', v_sub_id,
    'period_end', v_new_end
  );
end;
$$;

create or replace function public.billing_apply_payment_failed(
  p_account_id uuid,
  p_order_id text,
  p_payment_id text,
  p_plan_slug text,
  p_amount_paise bigint,
  p_currency text,
  p_error_code text,
  p_error_description text,
  p_grace_days integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment record;
  v_now timestamptz := now();
  v_grace timestamptz;
  v_amount numeric := round(coalesce(p_amount_paise, 0) / 100.0, 2);
  v_marked boolean := false;
begin
  if p_account_id is null or coalesce(p_payment_id, '') = '' then
    raise exception 'billing_apply_payment_failed: missing payment identity';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('billing:' || p_account_id::text, 0)
  );

  select id, status into v_payment
  from public.platform_payments
  where razorpay_payment_id = p_payment_id
  for update;

  if v_payment.id is not null then
    return jsonb_build_object('status', 'already_processed');
  end if;

  v_grace := v_now + make_interval(days => greatest(coalesce(p_grace_days, 3), 0));

  -- Only subscriptions that had access enter the dunning path. A first
  -- payment that fails leaves the account in PENDING_PAYMENT.
  update public.subscriptions
  set status = 'PAST_DUE', grace_period_end = v_grace, updated_at = v_now
  where account_id = p_account_id
    and status in ('ACTIVE', 'TRIALING', 'PAST_DUE');
  v_marked := found;

  if exists (
    select 1 from public.platform_payments where razorpay_order_id = p_order_id
  ) then
    update public.platform_payments set
      razorpay_payment_id = p_payment_id,
      status = 'failed',
      metadata = jsonb_build_object(
        'gateway', 'razorpay',
        'error_code', p_error_code,
        'error_description', p_error_description
      ),
      updated_at = v_now
    where razorpay_order_id = p_order_id;
  else
    insert into public.platform_payments (
      account_id, razorpay_order_id, razorpay_payment_id, amount, currency,
      plan_slug, payment_type, status, period_start, period_end, metadata
    ) values (
      p_account_id, p_order_id, p_payment_id, v_amount,
      coalesce(p_currency, 'INR'), coalesce(p_plan_slug, 'custom'),
      'monthly_renewal', 'failed', v_now, v_now,
      jsonb_build_object(
        'gateway', 'razorpay',
        'error_code', p_error_code,
        'error_description', p_error_description
      )
    );
  end if;

  update public.billing_orders
  set status = 'failed', updated_at = v_now
  where razorpay_order_id = p_order_id;

  insert into public.audit_logs (account_id, action, target_type, metadata)
  values (
    p_account_id, 'billing.payment_failed', 'subscription',
    jsonb_build_object(
      'gateway', 'razorpay',
      'razorpay_payment_id', p_payment_id,
      'razorpay_order_id', p_order_id,
      'error_code', p_error_code,
      'marked_past_due', v_marked,
      'grace_period_end', v_grace
    )
  );

  if v_marked then
    begin
      update public.accounts
      set subscription_status = 'PAST_DUE', updated_at = v_now
      where id = p_account_id;
    exception when undefined_column then
      null;
    end;
  end if;

  return jsonb_build_object(
    'status', 'processed',
    'marked_past_due', v_marked,
    'grace_period_end', v_grace
  );
end;
$$;

revoke all on function public.billing_apply_payment_captured(uuid, text, text, text, bigint, text, boolean, numeric, numeric, text, text, text) from public;
revoke all on function public.billing_apply_payment_captured(uuid, text, text, text, bigint, text, boolean, numeric, numeric, text, text, text) from anon;
revoke all on function public.billing_apply_payment_captured(uuid, text, text, text, bigint, text, boolean, numeric, numeric, text, text, text) from authenticated;
grant execute on function public.billing_apply_payment_captured(uuid, text, text, text, bigint, text, boolean, numeric, numeric, text, text, text) to service_role;

revoke all on function public.billing_apply_payment_failed(uuid, text, text, text, bigint, text, text, text, integer) from public;
revoke all on function public.billing_apply_payment_failed(uuid, text, text, text, bigint, text, text, text, integer) from anon;
revoke all on function public.billing_apply_payment_failed(uuid, text, text, text, bigint, text, text, text, integer) from authenticated;
grant execute on function public.billing_apply_payment_failed(uuid, text, text, text, bigint, text, text, text, integer) to service_role;

commit;
