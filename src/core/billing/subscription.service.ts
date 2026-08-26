/**
 * Helpa Core SaaS Billing — Subscription Lifecycle & State Machine
 *
 * Canonical state lives in `public.subscriptions`; every lifecycle
 * transition writes there first. `accounts.subscription_plan/status` is
 * kept as a read-compat mirror and is updated after the canonical write
 * succeeds (the Razorpay payment RPC updates both inside one database
 * transaction; these administrative transitions mirror best-effort).
 *
 * State transitions implemented here and in the payment webhook:
 * - New account (no row)            → PENDING_PAYMENT (synthesized, never stored as paid)
 * - startFreeTrial                  → TRIALING with trial_start/trial_end
 * - First captured payment          → ACTIVE (webhook RPC)
 * - Renewal captured                → ACTIVE, period extended exactly once (webhook RPC)
 * - handlePaymentFailure            → PAST_DUE with grace_period_end
 * - Grace elapsed (cron)            → EXPIRED
 * - cancelSubscription(periodEnd)   → stays ACTIVE, cancel_at_period_end=true
 * - cancelSubscription(immediate)   → CANCELLED, cancel_at_period_end=false
 * - reactivateSubscription          → ACTIVE with cancellation flags cleared
 *
 * Lifecycle fields are stored in proper subscription columns; this module
 * never writes accounts.extra_attributes (which previously clobbered the
 * whole JSON object).
 */

import {
  WorkspaceSubscription,
  SubscriptionStatus,
  BillingCycle,
} from './types';
import { getPlanById } from './plans';
import { addBillingInterval } from './period';
import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';

type AdminDb = ReturnType<typeof getAdminClient>;

async function findSubscriptionRow(
  db: AdminDb,
  accountId: string
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw new Error('Subscription lookup failed');
  return data ?? null;
}

/** Insert-or-update the canonical subscription row, checking results. */
async function writeSubscriptionRow(
  db: AdminDb,
  accountId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const existing = await findSubscriptionRow(db, accountId);

  if (existing) {
    const { error } = await db
      .from('subscriptions')
      .update({ ...fields, updated_at: nowIso })
      .eq('id', existing.id);
    if (error) throw new Error('Subscription update failed');
    return;
  }

  const { error } = await db.from('subscriptions').insert({
    account_id: accountId,
    ...fields,
    created_at: nowIso,
    updated_at: nowIso,
  });
  if (error) throw new Error('Subscription insert failed');
}

/** Read-compat mirror; runs after the canonical write succeeded. */
async function mirrorAccountStatus(
  db: AdminDb,
  accountId: string,
  fields: { subscription_plan?: string; subscription_status: string }
): Promise<void> {
  const { error } = await db
    .from('accounts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', accountId);
  if (error) {
    console.error(
      '[billing] account status mirror failed (canonical state already updated):',
      error
    );
  }
}

/**
 * Initializes a new workspace with a Free Trial on the specified plan.
 */
export async function startFreeTrial({
  workspaceId,
  planId = 'plan_growth',
  trialDays = 14,
}: {
  workspaceId: string;
  planId?: string;
  trialDays?: number;
}): Promise<WorkspaceSubscription> {
  const db = getAdminClient();
  const plan = await getPlanById(planId);

  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setUTCDate(
    trialEndDate.getUTCDate() + (trialDays || plan.trialDays || 14)
  );

  await writeSubscriptionRow(db, workspaceId, {
    plan_slug: plan.slug,
    status: 'TRIALING',
    setup_fee_paid: false,
    trial_start: now.toISOString(),
    trial_end: trialEndDate.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: trialEndDate.toISOString(),
    end_date: trialEndDate.toISOString(),
    cancel_at_period_end: false,
    cancelled_at: null,
    grace_period_end: null,
    currency: plan.currency,
    monthly_amount: plan.monthlyPrice,
    setup_fee_amount: plan.setupFee,
    payment_provider: 'razorpay',
  });

  await mirrorAccountStatus(db, workspaceId, {
    subscription_plan: plan.id,
    subscription_status: 'TRIALING',
  });

  const subscription: WorkspaceSubscription = {
    id: `sub-${workspaceId}`,
    workspaceId,
    planId: plan.id,
    planSlug: plan.slug,
    status: 'TRIALING',
    billingCycle: 'monthly',
    setupFeePaid: false,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEndDate.toISOString(),
    trialStart: now.toISOString(),
    trialEnd: trialEndDate.toISOString(),
    cancelAtPeriodEnd: false,
    paymentProvider: 'razorpay',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  coreEvents.emit('billing.trial_started', workspaceId, {
    planId: plan.id,
    trialEnd: subscription.trialEnd,
    timestamp: now.toISOString(),
  });

  return subscription;
}

/**
 * Applies a paid plan change after payment has been verified.
 *
 * Called from verified payment processing only (the Razorpay webhook uses
 * the atomic RPC; this TS path serves internal/legacy event processing).
 * It must never be reachable from unauthenticated or client-driven input.
 */
export async function upgradeSubscription({
  workspaceId,
  newPlanId,
  billingCycle = 'monthly',
  externalCustomerId,
  externalSubscriptionId,
}: {
  workspaceId: string;
  newPlanId: string;
  billingCycle?: BillingCycle;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}): Promise<WorkspaceSubscription> {
  const db = getAdminClient();
  const plan = await getPlanById(newPlanId);

  const now = new Date();
  const periodEnd = addBillingInterval(
    now,
    billingCycle === 'yearly' ? 'yearly' : 'monthly'
  );

  await writeSubscriptionRow(db, workspaceId, {
    plan_slug: plan.slug,
    status: 'ACTIVE',
    billing_interval: billingCycle,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    end_date: periodEnd.toISOString(),
    cancel_at_period_end: false,
    cancelled_at: null,
    grace_period_end: null,
    currency: plan.currency,
    monthly_amount: plan.monthlyPrice,
    setup_fee_amount: plan.setupFee,
    payment_provider: 'razorpay',
    external_subscription_id: externalSubscriptionId ?? null,
  });

  await mirrorAccountStatus(db, workspaceId, {
    subscription_plan: plan.id,
    subscription_status: 'ACTIVE',
  });

  const subscription: WorkspaceSubscription = {
    id: `sub-${workspaceId}`,
    workspaceId,
    planId: plan.id,
    planSlug: plan.slug,
    status: 'ACTIVE',
    billingCycle,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    paymentProvider: 'razorpay',
    externalCustomerId,
    externalSubscriptionId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  coreEvents.emit('billing.subscription_activated', workspaceId, {
    planId: plan.id,
    billingCycle,
    timestamp: now.toISOString(),
  });

  return subscription;
}

/**
 * Cancels a subscription at period end or immediately.
 *
 * - Period-end: status stays ACTIVE until currentPeriodEnd with
 *   cancel_at_period_end=true.
 * - Immediate: status becomes CANCELLED with cancel_at_period_end=false.
 */
export async function cancelSubscription({
  workspaceId,
  cancelImmediately = false,
}: {
  workspaceId: string;
  cancelImmediately?: boolean;
}): Promise<boolean> {
  const db = getAdminClient();
  const now = new Date().toISOString();

  const newStatus: SubscriptionStatus = cancelImmediately
    ? 'CANCELLED'
    : 'ACTIVE';

  await writeSubscriptionRow(db, workspaceId, {
    status: newStatus,
    cancel_at_period_end: !cancelImmediately,
    cancelled_at: now,
  });

  await mirrorAccountStatus(db, workspaceId, {
    subscription_status: newStatus,
  });

  coreEvents.emit('billing.subscription_cancelled', workspaceId, {
    cancelImmediately,
    timestamp: now,
  });

  return true;
}

/**
 * Reactivates a subscription that was marked for cancellation at period
 * end, clearing the cancellation flags.
 */
export async function reactivateSubscription(
  workspaceId: string
): Promise<boolean> {
  const db = getAdminClient();

  await writeSubscriptionRow(db, workspaceId, {
    status: 'ACTIVE',
    cancel_at_period_end: false,
    cancelled_at: null,
  });

  await mirrorAccountStatus(db, workspaceId, {
    subscription_status: 'ACTIVE',
  });

  return true;
}

/**
 * Handles payment failure by placing the workspace in PAST_DUE with a
 * grace period. Access remains available until grace_period_end (see
 * hasPaidAccess); the lifecycle cron then transitions to EXPIRED.
 */
export async function handlePaymentFailure(
  workspaceId: string,
  gracePeriodDays: number = 3
): Promise<void> {
  const db = getAdminClient();
  const now = new Date();
  const graceEnd = new Date(now);
  graceEnd.setUTCDate(graceEnd.getUTCDate() + gracePeriodDays);

  await writeSubscriptionRow(db, workspaceId, {
    status: 'PAST_DUE',
    grace_period_end: graceEnd.toISOString(),
  });

  await mirrorAccountStatus(db, workspaceId, {
    subscription_status: 'PAST_DUE',
  });

  coreEvents.emit('billing.payment_failed', workspaceId, {
    gracePeriodEnd: graceEnd.toISOString(),
    timestamp: now.toISOString(),
  });
}
