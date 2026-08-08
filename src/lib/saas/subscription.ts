import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function checkPlanLimits(
  accountId: string,
  limitKey: 'max_users' | 'max_contacts' | 'max_ai_requests'
): Promise<boolean> {
  const db = supabaseAdmin();

  // 1. Get active subscription and its plan details
  const { data: sub, error } = await db
    .from('subscriptions')
    .select('status, plan:plans(*)')
    .eq('account_id', accountId)
    .single();

  if (error || !sub) {
    // Fallback: If no subscription is configured yet (e.g. during onboarding), allow
    console.warn(
      `[SaaS Limits] No subscription found for account: ${accountId}. Allowing bypass.`
    );
    return true;
  }

  if (sub.status === 'expired' || sub.status === 'cancelled') {
    throw new Error(
      'Subscription inactive or expired. Please renew your plan.'
    );
  }

  const planObj = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  const plan = planObj as {
    max_users: number;
    max_contacts: number;
    max_ai_requests: number;
  } | null;
  if (!plan) return true;

  const limitValue = plan[limitKey];

  // 2. Count current usage
  if (limitKey === 'max_contacts') {
    const { count } = await db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if ((count ?? 0) >= limitValue) {
      throw new Error(
        `Plan contact limit of ${limitValue} exceeded. Please upgrade your plan.`
      );
    }
  }

  if (limitKey === 'max_users') {
    const { count } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if ((count ?? 0) >= limitValue) {
      throw new Error(
        `Plan team member limit of ${limitValue} exceeded. Please upgrade your plan.`
      );
    }
  }

  if (limitKey === 'max_ai_requests') {
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
    const { data: usage } = await db
      .from('usage_tracking')
      .select('ai_requests')
      .eq('account_id', accountId)
      .eq('month', currentMonth)
      .maybeSingle();

    if ((usage?.ai_requests ?? 0) >= limitValue) {
      throw new Error(
        `Monthly AI request limit of ${limitValue} exceeded. Please upgrade your plan.`
      );
    }
  }

  return true;
}

export async function incrementUsage(
  accountId: string,
  metric: 'ai_requests' | 'whatsapp_messages'
): Promise<void> {
  const db = supabaseAdmin();
  const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

  const { error } = await db.rpc('increment_usage_metric', {
    p_account_id: accountId,
    p_month: currentMonth,
    p_metric: metric,
  });

  if (error) {
    console.error(
      `[SaaS Usage] Failed to increment usage metric ${metric}:`,
      error
    );
  }
}
