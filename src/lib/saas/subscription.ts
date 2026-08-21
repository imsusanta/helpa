import { getAdminClient } from '@/lib/appwrite-server-compat';
import { getPlanBySlug } from '@/core/billing/plans';
import {
  FeatureAccessResult,
  SubscriptionPlan,
  UsageLimitCheckResult,
  WorkspaceSubscription,
} from '@/core/billing/types';

const ACCESSIBLE_STATUSES = new Set<WorkspaceSubscription['status']>([
  'ACTIVE',
  'TRIAL',
  'TRIALING',
  'PAST_DUE',
]);

function requireAccountId(accountId: string): string {
  const normalized = accountId?.trim();
  if (!normalized) throw new Error('ACCOUNT_ID_REQUIRED');
  return normalized;
}

function throwOnDatabaseError(error: unknown, operation: string): void {
  if (!error) return;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error);
  throw new Error(`${operation}: ${message}`);
}

export async function getWorkspaceSubscription(
  rawAccountId: string
): Promise<{ subscription: WorkspaceSubscription; plan: SubscriptionPlan }> {
  const accountId = requireAccountId(rawAccountId);
  const db = getAdminClient();

  const { data: subData, error: subscriptionError } = await db
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('account_id', accountId)
    .maybeSingle();
  throwOnDatabaseError(subscriptionError, 'SUBSCRIPTION_LOOKUP_FAILED');

  const { data: accountData, error: accountError } = await db
    .from('accounts')
    .select('id, subscription_plan, subscription_status')
    .eq('id', accountId)
    .maybeSingle();
  throwOnDatabaseError(accountError, 'ACCOUNT_SUBSCRIPTION_LOOKUP_FAILED');

  const persistedPlanId =
    subData?.plan_slug ||
    subData?.plan?.slug ||
    subData?.plan?.id ||
    (subData?.plan?.name
      ? String(subData.plan.name)
          .toLowerCase()
          .replace(/[^a-z]/g, '')
      : undefined) ||
    accountData?.subscription_plan;

  // Starter is used only as a safe display shape. A missing persisted
  // subscription receives INCOMPLETE status and is denied by all gates.
  const plan = await getPlanBySlug(persistedPlanId || 'starter');
  if (!plan.isActive) throw new Error('SUBSCRIPTION_PLAN_INACTIVE');

  const now = new Date().toISOString();
  const status =
    (subData?.status as WorkspaceSubscription['status'] | undefined) ||
    (accountData?.subscription_status as
      | WorkspaceSubscription['status']
      | undefined) ||
    'INCOMPLETE';

  const subscription: WorkspaceSubscription = {
    id: subData?.id || `sub_${accountId}`,
    workspaceId: accountId,
    planId: plan.id,
    planSlug: plan.slug,
    status,
    billingCycle: 'monthly',
    setupFeePaid: subData?.setup_fee_paid ?? false,
    setupFeeAmount: subData?.setup_fee_amount ?? plan.setupFee,
    monthlyAmount: subData?.monthly_amount ?? plan.monthlyPrice,
    currency: plan.currency,
    currentPeriodStart: subData?.current_period_start || now,
    currentPeriodEnd:
      subData?.end_date || subData?.current_period_end || now,
    cancelAtPeriodEnd: subData?.cancel_at_period_end ?? false,
    cancelledAt: subData?.cancelled_at,
    paymentProvider: subData?.payment_provider || 'helpa_billing',
    createdAt: subData?.created_at || now,
    updatedAt: subData?.updated_at || now,
  };

  return { subscription, plan };
}

export async function checkFeatureAccess(
  accountId: string,
  featureKey: string
): Promise<FeatureAccessResult> {
  try {
    const { subscription, plan } = await getWorkspaceSubscription(accountId);

    if (!ACCESSIBLE_STATUSES.has(subscription.status)) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: plan.name,
        reason: `Your subscription is ${subscription.status.toLowerCase().replace(/_/g, ' ')}. Please activate or renew your plan to access this feature.`,
      };
    }

    const [featureDomain] = featureKey.split('.');
    const hasAccess =
      plan.features.includes(featureKey) ||
      plan.features.includes(`${featureDomain}.*`) ||
      plan.features.includes('*') ||
      plan.features.includes('all');

    if (!hasAccess) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: 'Growth ⭐ or Pro',
        reason: `The feature "${featureKey}" is not included in your ${plan.name} plan. Upgrade to unlock this feature.`,
      };
    }

    return { allowed: true, featureKey };
  } catch (error) {
    console.error('[checkFeatureAccess] denied after lookup failure:', error);
    return {
      allowed: false,
      featureKey,
      reason: 'Feature entitlement could not be verified. Please try again.',
    };
  }
}

export async function checkPlanLimits(
  rawAccountId: string,
  limitKey:
    | 'max_users'
    | 'max_contacts'
    | 'max_ai_requests'
    | 'whatsapp_messages'
    | 'automations'
): Promise<UsageLimitCheckResult> {
  try {
    const accountId = requireAccountId(rawAccountId);
    const db = getAdminClient();
    const { subscription, plan } = await getWorkspaceSubscription(accountId);

    if (!ACCESSIBLE_STATUSES.has(subscription.status)) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        percentageUsed: 100,
        warningLevel: '100%',
        reason: `Your subscription is ${subscription.status.toLowerCase().replace(/_/g, ' ')}. Please activate or renew it before using ${limitKey.replace(/_/g, ' ')}.`,
      };
    }

    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    let currentUsage: number;
    let limit: number;

    if (limitKey === 'max_users') {
      limit = plan.usageLimits.teamMembers;
      const { count, error } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      throwOnDatabaseError(error, 'TEAM_USAGE_LOOKUP_FAILED');
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_contacts') {
      limit = plan.usageLimits.contacts;
      const { count, error } = await db
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      throwOnDatabaseError(error, 'CONTACT_USAGE_LOOKUP_FAILED');
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_ai_requests') {
      limit = plan.usageLimits.aiMessages;
      const { data, error } = await db
        .from('usage_tracking')
        .select('ai_requests')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      throwOnDatabaseError(error, 'AI_USAGE_LOOKUP_FAILED');
      currentUsage = data?.ai_requests ?? 0;
    } else if (limitKey === 'whatsapp_messages') {
      limit = plan.usageLimits.whatsappMessages;
      const { data, error } = await db
        .from('usage_tracking')
        .select('whatsapp_messages')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      throwOnDatabaseError(error, 'WHATSAPP_USAGE_LOOKUP_FAILED');
      currentUsage = data?.whatsapp_messages ?? 0;
    } else {
      limit = plan.usageLimits.automations ?? 0;
      const { count, error } = await db
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      throwOnDatabaseError(error, 'AUTOMATION_USAGE_LOOKUP_FAILED');
      currentUsage = count ?? 0;
    }

    if (limit === 0) {
      return {
        allowed: true,
        currentUsage,
        limit,
        remaining: Infinity,
        percentageUsed: 0,
      };
    }

    const remaining = Math.max(0, limit - currentUsage);
    const percentageUsed = Math.min(
      100,
      Math.round((currentUsage / limit) * 100)
    );
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
  } catch (error) {
    console.error('[checkPlanLimits] denied after lookup failure:', error);
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      percentageUsed: 100,
      warningLevel: '100%',
      reason: 'Usage entitlement could not be verified. Please try again.',
    };
  }
}

export async function incrementUsage(
  rawAccountId: string,
  metric: 'ai_requests' | 'whatsapp_messages',
  quantity: number = 1
): Promise<void> {
  const accountId = requireAccountId(rawAccountId);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('USAGE_QUANTITY_MUST_BE_POSITIVE');
  }

  try {
    const db = getAdminClient();
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    const { data: existing, error: lookupError } = await db
      .from('usage_tracking')
      .select('id, ai_requests, whatsapp_messages')
      .eq('account_id', accountId)
      .eq('month', currentMonth)
      .maybeSingle();
    throwOnDatabaseError(lookupError, 'USAGE_LOOKUP_FAILED');

    if (existing) {
      const field =
        metric === 'ai_requests' ? 'ai_requests' : 'whatsapp_messages';
      const newValue = (Number(existing[field]) || 0) + quantity;

      const { error } = await db
        .from('usage_tracking')
        .update({ [field]: newValue, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('account_id', accountId);
      throwOnDatabaseError(error, 'USAGE_UPDATE_FAILED');
    } else {
      const { error } = await db.from('usage_tracking').insert({
        account_id: accountId,
        month: currentMonth,
        ai_requests: metric === 'ai_requests' ? quantity : 0,
        whatsapp_messages: metric === 'whatsapp_messages' ? quantity : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      throwOnDatabaseError(error, 'USAGE_INSERT_FAILED');
    }
  } catch (error) {
    console.error('[incrementUsage] usage was not recorded:', error);
    throw error;
  }
}

/**
 * Transition expired trials to TRIAL_EXPIRED and past-due subscriptions to EXPIRED.
 */
export async function expireStaleTrials(): Promise<{
  expiredTrialsCount: number;
  expiredSubsCount: number;
}> {
  try {
    const db = getAdminClient();
    const now = new Date().toISOString();

    const { data: staleTrials, error: trialLookupError } = await db
      .from('subscriptions')
      .select('id, account_id')
      .in('status', ['TRIAL', 'TRIALING'])
      .lt('trial_end', now);
    throwOnDatabaseError(trialLookupError, 'STALE_TRIAL_LOOKUP_FAILED');

    let expiredTrialsCount = 0;
    if (staleTrials && staleTrials.length > 0) {
      for (const trial of staleTrials) {
        const { error } = await db
          .from('subscriptions')
          .update({ status: 'TRIAL_EXPIRED', updated_at: now })
          .eq('id', trial.id)
          .eq('account_id', trial.account_id);
        throwOnDatabaseError(error, 'TRIAL_EXPIRATION_FAILED');
        expiredTrialsCount++;
      }
    }

    const { data: pastDueSubs, error: pastDueLookupError } = await db
      .from('subscriptions')
      .select('id, account_id')
      .eq('status', 'PAST_DUE')
      .lt('end_date', now);
    throwOnDatabaseError(pastDueLookupError, 'PAST_DUE_LOOKUP_FAILED');

    let expiredSubsCount = 0;
    if (pastDueSubs && pastDueSubs.length > 0) {
      for (const subscription of pastDueSubs) {
        const { error } = await db
          .from('subscriptions')
          .update({ status: 'EXPIRED', updated_at: now })
          .eq('id', subscription.id)
          .eq('account_id', subscription.account_id);
        throwOnDatabaseError(error, 'SUBSCRIPTION_EXPIRATION_FAILED');
        expiredSubsCount++;
      }
    }

    return { expiredTrialsCount, expiredSubsCount };
  } catch (error) {
    console.error('[expireStaleTrials] expiration job failed:', error);
    throw error;
  }
}
