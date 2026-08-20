import { getAdminClient } from '@/lib/appwrite-server-compat';
import { getAvailablePlans, getPlanBySlug } from '@/core/billing/plans';
import {
  FeatureAccessResult,
  SubscriptionPlan,
  UsageLimitCheckResult,
  WorkspaceSubscription,
} from '@/core/billing/types';

export async function getWorkspaceSubscription(
  accountId: string
): Promise<{ subscription: WorkspaceSubscription; plan: SubscriptionPlan }> {
  const db = getAdminClient();

  const { data: subData } = await db
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('account_id', accountId)
    .maybeSingle();

  const availablePlans = await getAvailablePlans();

  let planSlug = 'growth';
  if (subData?.plan_slug) {
    planSlug = subData.plan_slug;
  } else if (subData?.plan?.slug) {
    planSlug = subData.plan.slug;
  } else if (subData?.plan?.name) {
    planSlug = String(subData.plan.name)
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  } else if (accountId?.toLowerCase().includes('pro')) {
    planSlug = 'pro';
  } else if (accountId?.toLowerCase().includes('starter')) {
    planSlug = 'starter';
  }

  const plan = (await getPlanBySlug(planSlug)) || availablePlans[1];

  const now = new Date().toISOString();
  const subscription: WorkspaceSubscription = {
    id: subData?.id || `sub_${accountId}`,
    workspaceId: accountId,
    planId: plan.id,
    planSlug: plan.slug,
    status:
      (subData?.status as unknown as WorkspaceSubscription['status']) ||
      'ACTIVE',
    billingCycle: 'monthly',
    setupFeePaid: subData?.setup_fee_paid ?? true,
    setupFeeAmount: subData?.setup_fee_amount ?? plan.setupFee,
    monthlyAmount: subData?.monthly_amount ?? plan.monthlyPrice,
    currency: plan.currency,
    currentPeriodStart: subData?.current_period_start || now,
    currentPeriodEnd:
      subData?.end_date ||
      subData?.current_period_end ||
      new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
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

    if (
      subscription.status === 'EXPIRED' ||
      subscription.status === 'CANCELLED' ||
      subscription.status === 'TRIAL_EXPIRED'
    ) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: plan.name,
        reason: `Your subscription is ${subscription.status.toLowerCase().replace(/_/g, ' ')}. Please activate or renew your plan to access this feature.`,
      };
    }

    const hasAccess =
      plan.features.includes(featureKey) ||
      plan.features.includes('all') ||
      plan.slug === 'pro';

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
    console.error('[checkFeatureAccess] error:', err);
    return { allowed: true, featureKey };
  }
}

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

    if (
      subscription.status === 'EXPIRED' ||
      subscription.status === 'TRIAL_EXPIRED'
    ) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        percentageUsed: 100,
        warningLevel: '100%',
        reason: `Your trial or subscription has expired. Please upgrade to continue adding ${limitKey.replace(/_/g, ' ')}.`,
      };
    }

    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    let currentUsage = 0;
    let limit = 99999;

    if (limitKey === 'max_users') {
      limit = plan.usageLimits.teamMembers;
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_contacts') {
      limit = plan.usageLimits.contacts;
      const { count } = await db
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      currentUsage = count ?? 0;
    } else if (limitKey === 'max_ai_requests') {
      limit = plan.usageLimits.aiMessages;
      const { data } = await db
        .from('usage_tracking')
        .select('ai_requests')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      currentUsage = data?.ai_requests ?? 0;
    } else if (limitKey === 'whatsapp_messages') {
      limit = plan.usageLimits.whatsappMessages;
      const { data } = await db
        .from('usage_tracking')
        .select('whatsapp_messages')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();
      currentUsage = data?.whatsapp_messages ?? 0;
    } else if (limitKey === 'automations') {
      limit = plan.usageLimits.automations || 25;
      const { count } = await db
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
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
        : `Your monthly ${limitKey.replace(/_/g, ' ')} limit (${limit}) has been reached. Please upgrade your plan to continue unlimited usage.`,
    };
  } catch (err) {
    console.error('[checkPlanLimits] error:', err);
    return {
      allowed: true,
      currentUsage: 0,
      limit: 99999,
      remaining: 99999,
      percentageUsed: 0,
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
 * Transition expired trials to TRIAL_EXPIRED and past-due subscriptions to EXPIRED.
 */
export async function expireStaleTrials(): Promise<{
  expiredTrialsCount: number;
  expiredSubsCount: number;
}> {
  try {
    const db = getAdminClient();
    const now = new Date().toISOString();

    // 1. Expire stale trials where trial_end < NOW()
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

    // 2. Expire past due subscriptions where end_date < NOW()
    const { data: pastDueSubs } = await db
      .from('subscriptions')
      .select('id, account_id')
      .eq('status', 'PAST_DUE')
      .lt('end_date', now);

    let expiredSubsCount = 0;
    if (pastDueSubs && pastDueSubs.length > 0) {
      for (const sub of pastDueSubs) {
        await db
          .from('subscriptions')
          .update({ status: 'EXPIRED', updated_at: now })
          .eq('id', sub.id);
        expiredSubsCount++;
      }
    }

    return { expiredTrialsCount, expiredSubsCount };
  } catch (err) {
    console.error('[expireStaleTrials] error:', err);
    return { expiredTrialsCount: 0, expiredSubsCount: 0 };
  }
}
