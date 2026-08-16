/**
 * Helpa Core SaaS Billing — Subscription Lifecycle & State Machine
 *
 * Trial initialization, upgrades, downgrades, cancellations, and status transitions.
 */

import {
  WorkspaceSubscription,
  SubscriptionStatus,
  BillingCycle,
} from './types';
import { getPlanById } from './plans';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

/**
 * Initializes a new workspace with a Free Trial on the specified plan.
 */
export async function startFreeTrial({
  workspaceId,
  planId = 'plan_professional',
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
  trialEndDate.setDate(trialEndDate.getDate() + (trialDays || plan.trialDays || 14));

  const subscription: WorkspaceSubscription = {
    id: `sub-${workspaceId}`,
    workspaceId,
    planId: plan.id,
    status: 'TRIALING',
    billingCycle: 'monthly',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEndDate.toISOString(),
    trialStart: now.toISOString(),
    trialEnd: trialEndDate.toISOString(),
    cancelAtPeriodEnd: false,
    paymentProvider: 'Razorpay',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await db.from('accounts').update({
    subscription_plan: plan.id,
    subscription_status: 'TRIALING',
    extra_attributes: {
      trial_start: subscription.trialStart,
      trial_end: subscription.trialEnd,
    },
    updated_at: now.toISOString(),
  }).eq('id', workspaceId);

  coreEvents.emit('billing.trial_started', workspaceId, {
    planId: plan.id,
    trialEnd: subscription.trialEnd,
    timestamp: now.toISOString(),
  });

  return subscription;
}

/**
 * Upgrades or modifies a workspace subscription to a paid plan.
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
  const periodEnd = new Date(now);
  if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const subscription: WorkspaceSubscription = {
    id: `sub-${workspaceId}`,
    workspaceId,
    planId: plan.id,
    status: 'ACTIVE',
    billingCycle,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    paymentProvider: 'Razorpay',
    externalCustomerId,
    externalSubscriptionId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await db.from('accounts').update({
    subscription_plan: plan.id,
    subscription_status: 'ACTIVE',
    extra_attributes: {
      billing_cycle: billingCycle,
      current_period_start: subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      external_customer_id: externalCustomerId,
      external_subscription_id: externalSubscriptionId,
    },
    updated_at: now.toISOString(),
  }).eq('id', workspaceId);

  coreEvents.emit('billing.subscription_activated', workspaceId, {
    planId: plan.id,
    billingCycle,
    timestamp: now.toISOString(),
  });

  return subscription;
}

/**
 * Cancels a subscription at period end or immediately.
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

  const newStatus: SubscriptionStatus = cancelImmediately ? 'CANCELLED' : 'ACTIVE';

  await db.from('accounts').update({
    subscription_status: newStatus,
    extra_attributes: {
      cancel_at_period_end: true,
      cancelled_at: now,
    },
    updated_at: now,
  }).eq('id', workspaceId);

  coreEvents.emit('billing.subscription_cancelled', workspaceId, {
    cancelImmediately,
    timestamp: now,
  });

  return true;
}

/**
 * Reactivates a subscription that was marked for cancellation at period end.
 */
export async function reactivateSubscription(workspaceId: string): Promise<boolean> {
  const db = getAdminClient();
  const now = new Date().toISOString();

  await db.from('accounts').update({
    subscription_status: 'ACTIVE',
    extra_attributes: {
      cancel_at_period_end: false,
      cancelled_at: null,
    },
    updated_at: now,
  }).eq('id', workspaceId);

  return true;
}

/**
 * Handles payment failure by placing workspace in PAST_DUE status with a grace period.
 */
export async function handlePaymentFailure(
  workspaceId: string,
  gracePeriodDays: number = 3
): Promise<void> {
  const db = getAdminClient();
  const now = new Date();
  const graceEnd = new Date(now);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);

  await db.from('accounts').update({
    subscription_status: 'PAST_DUE',
    extra_attributes: {
      grace_period_end: graceEnd.toISOString(),
    },
    updated_at: now.toISOString(),
  }).eq('id', workspaceId);

  coreEvents.emit('billing.payment_failed', workspaceId, {
    gracePeriodEnd: graceEnd.toISOString(),
    timestamp: now.toISOString(),
  });
}
