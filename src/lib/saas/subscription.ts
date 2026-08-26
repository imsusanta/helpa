import { getAdminClient } from '@/lib/db/server';
import { getPlanBySlug, DEFAULT_PLANS } from '@/core/billing/plans';
import {
  FeatureAccessResult,
  SubscriptionPlan,
  SubscriptionStatus,
  UsageLimitCheckResult,
  WorkspaceSubscription,
} from '@/core/billing/types';

export class SubscriptionLookupError extends Error {
  readonly code = 'SUBSCRIPTION_LOOKUP_FAILED';

  constructor(message = 'Unable to load the workspace subscription') {
    super(message);
    this.name = 'SubscriptionLookupError';
  }
}

const KNOWN_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'TRIAL',
  'PENDING_PAYMENT',
  'ACTIVE',
  'PAST_DUE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
  'TRIALING',
  'INCOMPLETE',
  'TRIAL_EXPIRED',
]);

function normalizeStatus(raw: unknown): SubscriptionStatus {
  const value = String(raw || '')
    .trim()
    .toUpperCase();
  if (value === 'TRIAL') return 'TRIALING';
  if (KNOWN_STATUSES.has(value as SubscriptionStatus)) {
    return value as SubscriptionStatus;
  }
  // A row with an unrecognized status must never receive paid access.
  return 'INCOMPLETE';
}

/**
 * Paid-access policy (documented, single source of truth):
 * - ACTIVE and TRIALING have access.
 * - PAST_DUE has access ONLY while a grace period is set and has not
 *   elapsed. Without a grace_period_end (or after it), access is denied.
 * - PENDING_PAYMENT, INCOMPLETE, PAUSED, CANCELLED, EXPIRED, and
 *   TRIAL_EXPIRED never have paid access.
 */
export function hasPaidAccess(
  subscription: Pick<WorkspaceSubscription, 'status' | 'gracePeriodEnd'>,
  now: Date = new Date()
): boolean {
  if (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') {
    return true;
  }
  if (subscription.status === 'PAST_DUE') {
    if (!subscription.gracePeriodEnd) return false;
    return new Date(subscription.gracePeriodEnd) > now;
  }
  return false;
}

function accessDeniedReason(status: SubscriptionStatus): string {
  if (status === 'PENDING_PAYMENT' || status === 'INCOMPLETE') {
    return 'No active subscription found for this workspace. Please choose a plan and complete payment to unlock this feature.';
  }
  if (status === 'PAST_DUE') {
    return 'Your last payment failed and the grace period has ended. Please renew your plan to restore access.';
  }
  return `Your subscription is ${status.toLowerCase().replace(/_/g, ' ')}. Please activate or renew your plan to access this feature.`;
}

/**
 * Loads the canonical subscription state for a workspace.
 *
 * Fail-closed rules:
 * - A missing subscription row is returned as PENDING_PAYMENT with
 *   setupFeePaid=false. It is never synthesized as an ACTIVE paid plan.
 * - A database error throws SubscriptionLookupError — callers must treat
 *   that as "access denied", never as paid access.
 * - The plan is resolved only from the persisted plan_slug (or the joined
 *   plans row). Unknown identifiers throw PlanNotFoundError instead of
 *   silently defaulting to Growth. Account-id strings are never inspected.
 *
 * When no subscription row exists, the returned `plan` is the recommended
 * catalog plan for pricing display only; the PENDING_PAYMENT status denies
 * feature access regardless of that display plan.
 */
export async function getWorkspaceSubscription(accountId: string): Promise<{
  subscription: WorkspaceSubscription;
  plan: SubscriptionPlan;
  hasSubscriptionRow: boolean;
}> {
  const db = getAdminClient();

  const { data: subData, error } = await db
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error('[getWorkspaceSubscription] query failed:', error);
    throw new SubscriptionLookupError();
  }

  const now = new Date().toISOString();

  if (!subData) {
    const displayPlan =
      DEFAULT_PLANS.find((p) => p.isRecommended) || DEFAULT_PLANS[0];
    return {
      hasSubscriptionRow: false,
      plan: displayPlan,
      subscription: {
        id: `pending_${accountId}`,
        workspaceId: accountId,
        planId: displayPlan.id,
        planSlug: undefined,
        status: 'PENDING_PAYMENT',
        billingCycle: 'monthly',
        setupFeePaid: false,
        setupFeeAmount: displayPlan.setupFee,
        monthlyAmount: displayPlan.monthlyPrice,
        currency: displayPlan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: false,
        paymentProvider: 'razorpay',
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  const persistedSlug: string | undefined =
    subData.plan_slug || subData.plan?.slug || undefined;
  // Throws PlanNotFoundError for unknown/missing identifiers (fail closed).
  const plan = await getPlanBySlug(persistedSlug || '');

  const subscription: WorkspaceSubscription = {
    id: subData.id,
    workspaceId: accountId,
    planId: plan.id,
    planSlug: plan.slug,
    status: normalizeStatus(subData.status),
    billingCycle: subData.billing_interval === 'yearly' ? 'yearly' : 'monthly',
    setupFeePaid: subData.setup_fee_paid === true,
    setupFeeAmount: Number(subData.setup_fee_amount ?? plan.setupFee),
    monthlyAmount: Number(subData.monthly_amount ?? plan.monthlyPrice),
    currency: subData.currency || plan.currency,
    currentPeriodStart:
      subData.current_period_start || subData.created_at || now,
    currentPeriodEnd: subData.end_date || subData.current_period_end || now,
    trialStart: subData.trial_start || undefined,
    trialEnd: subData.trial_end || undefined,
    gracePeriodEnd: subData.grace_period_end || undefined,
    cancelAtPeriodEnd: subData.cancel_at_period_end === true,
    cancelledAt: subData.cancelled_at || undefined,
    paymentProvider: subData.payment_provider || 'razorpay',
    externalSubscriptionId: subData.external_subscription_id || undefined,
    createdAt: subData.created_at || now,
    updatedAt: subData.updated_at || now,
  };

  return { subscription, plan, hasSubscriptionRow: true };
}

const GENERIC_VERIFICATION_FAILURE =
  'Unable to verify your subscription right now. Please try again shortly.';

/**
 * Feature gate. Fails closed: database or plan-resolution errors deny
 * access with a generic reason and never leak internal error details.
 *
 * Pro access is granted through the plan's explicit feature entitlements
 * (the Pro catalog entry lists every feature); there is no slug-based
 * bypass.
 */
export async function checkFeatureAccess(
  accountId: string,
  featureKey: string
): Promise<FeatureAccessResult> {
  try {
    const { subscription, plan } = await getWorkspaceSubscription(accountId);

    if (!hasPaidAccess(subscription)) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: plan.name,
        reason: accessDeniedReason(subscription.status),
      };
    }

    const hasAccess =
      plan.features.includes(featureKey) ||
      plan.features.includes('all') ||
      plan.features.includes('*');

    if (!hasAccess) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: 'Growth ⭐ or Pro',
        reason: `The feature "${featureKey}" is not included in your ${plan.name} plan. Upgrade to unlock this feature.`,
      };
    }

    return { allowed: true, featureKey };
  } catch (err) {
    console.error('[checkFeatureAccess] fail-closed error:', err);
    return {
      allowed: false,
      featureKey,
      reason: GENERIC_VERIFICATION_FAILURE,
    };
  }
}

const LIMIT_FAIL_CLOSED: Omit<UsageLimitCheckResult, 'reason'> = {
  allowed: false,
  currentUsage: 0,
  limit: 0,
  remaining: 0,
  percentageUsed: 100,
  warningLevel: '100%',
};

/**
 * Usage-limit gate. Fails closed on subscription-state or database
 * errors, and denies all usage when the subscription has no paid access.
 */
export async function checkPlanLimits(
  accountId: string,
  limitKey:
    | 'max_users'
    | 'max_contacts'
    | 'max_ai_requests'
    | 'whatsapp_messages'
    | 'automations'
): Promise<UsageLimitCheckResult> {
  try {
    const db = getAdminClient();
    const { subscription, plan } = await getWorkspaceSubscription(accountId);

    if (!hasPaidAccess(subscription)) {
      return {
        ...LIMIT_FAIL_CLOSED,
        reason: accessDeniedReason(subscription.status),
      };
    }

    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    let currentUsage = 0;
    let limit = 0;

    if (limitKey === 'max_users') {
      limit = plan.usageLimits.teamMembers;
      const { count, error } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      if (error) throw error;
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_contacts') {
      limit = plan.usageLimits.contacts;
      const { count, error } = await db
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      if (error) throw error;
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_ai_requests') {
      limit = plan.usageLimits.aiMessages;
      const { data, error } = await db
        .from('usage_tracking')
        .select('ai_requests')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      if (error) throw error;
      currentUsage = data?.ai_requests ?? 0;
    } else if (limitKey === 'whatsapp_messages') {
      limit = plan.usageLimits.whatsappMessages;
      const { data, error } = await db
        .from('usage_tracking')
        .select('whatsapp_messages')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      if (error) throw error;
      currentUsage = data?.whatsapp_messages ?? 0;
    } else if (limitKey === 'automations') {
      limit = plan.usageLimits.automations || 25;
      const { count, error } = await db
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      if (error) throw error;
      currentUsage = count ?? 0;
    }

    const remaining = Math.max(0, limit - currentUsage);
    const percentageUsed =
      limit > 0 ? Math.min(100, Math.round((currentUsage / limit) * 100)) : 0;
    const allowed = currentUsage < limit;

    let warningLevel: '80%' | '90%' | '100%' | undefined;
    if (percentageUsed >= 100) warningLevel = '100%';
    else if (percentageUsed >= 90) warningLevel = '90%';
    else if (percentageUsed >= 80) warningLevel = '80%';

    return {
      allowed,
      currentUsage,
      limit,
      remaining,
      percentageUsed,
      warningLevel,
      reason: allowed
        ? undefined
        : `Your monthly ${limitKey.replace(/_/g, ' ')} limit (${limit}) has been reached. Please upgrade your plan to continue.`,
    };
  } catch (err) {
    console.error('[checkPlanLimits] fail-closed error:', err);
    return {
      ...LIMIT_FAIL_CLOSED,
      reason: GENERIC_VERIFICATION_FAILURE,
    };
  }
}

export async function incrementUsage(
  accountId: string,
  metric: 'ai_requests' | 'whatsapp_messages',
  quantity: number = 1
): Promise<void> {
  try {
    const db = getAdminClient();
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    const { data: existing } = await db
      .from('usage_tracking')
      .select('id, ai_requests, whatsapp_messages')
      .eq('account_id', accountId)
      .eq('month', currentMonth)
      .maybeSingle();

    if (existing) {
      const field =
        metric === 'ai_requests' ? 'ai_requests' : 'whatsapp_messages';
      const newVal = (Number(existing[field]) || 0) + quantity;

      await db
        .from('usage_tracking')
        .update({ [field]: newVal, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await db.from('usage_tracking').insert({
        account_id: accountId,
        month: currentMonth,
        ai_requests: metric === 'ai_requests' ? quantity : 0,
        whatsapp_messages: metric === 'whatsapp_messages' ? quantity : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[incrementUsage] error tracking usage:', err);
  }
}

/**
 * Lifecycle sweeper (cron):
 * - TRIALING past trial_end → TRIAL_EXPIRED
 * - PAST_DUE past grace_period_end (or past end_date when no grace is
 *   recorded) → EXPIRED
 */
export async function expireStaleTrials(): Promise<{
  expiredTrialsCount: number;
  expiredSubsCount: number;
}> {
  try {
    const db = getAdminClient();
    const now = new Date().toISOString();

    const { data: staleTrials } = await db
      .from('subscriptions')
      .select('id, account_id')
      .in('status', ['TRIAL', 'TRIALING'])
      .lt('trial_end', now);

    let expiredTrialsCount = 0;
    if (staleTrials && staleTrials.length > 0) {
      for (const trial of staleTrials) {
        await db
          .from('subscriptions')
          .update({ status: 'TRIAL_EXPIRED', updated_at: now })
          .eq('id', trial.id);
        expiredTrialsCount++;
      }
    }

    let expiredSubsCount = 0;

    const { data: graceLapsed } = await db
      .from('subscriptions')
      .select('id, account_id')
      .eq('status', 'PAST_DUE')
      .lt('grace_period_end', now);

    const { data: pastDueSubs } = await db
      .from('subscriptions')
      .select('id, account_id, grace_period_end')
      .eq('status', 'PAST_DUE')
      .lt('end_date', now);

    const toExpire = new Map<string, string>();
    for (const sub of graceLapsed || []) {
      toExpire.set(sub.id, sub.account_id);
    }
    for (const sub of pastDueSubs || []) {
      // Without a recorded grace period the end date is the deadline.
      if (!sub.grace_period_end) toExpire.set(sub.id, sub.account_id);
    }

    for (const [id] of toExpire) {
      await db
        .from('subscriptions')
        .update({ status: 'EXPIRED', updated_at: now })
        .eq('id', id);
      expiredSubsCount++;
    }

    return { expiredTrialsCount, expiredSubsCount };
  } catch (err) {
    console.error('[expireStaleTrials] error:', err);
    return { expiredTrialsCount: 0, expiredSubsCount: 0 };
  }
}
