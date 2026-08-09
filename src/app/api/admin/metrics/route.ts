import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = supabaseAdmin();
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    // 1. Fetch count of accounts
    const { count: totalAccounts, error: accError } = await db
      .from('accounts')
      .select('id', { count: 'exact', head: true });

    if (accError) throw accError;

    // 2. Fetch count of contacts
    const { count: totalContacts, error: conError } = await db
      .from('contacts')
      .select('id', { count: 'exact', head: true });

    if (conError) throw conError;

    // 3. Fetch count of profiles
    const { count: totalUsers, error: usrError } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (usrError) throw usrError;

    // 4. Fetch subscriptions count grouped by status
    const { data: subs, error: subError } = await db
      .from('subscriptions')
      .select('status, plan:plans(name)');

    if (subError) throw subError;

    // 5. Fetch usage tracking sum for current month
    const { data: usageData, error: usageError } = await db
      .from('usage_tracking')
      .select('ai_requests, whatsapp_messages')
      .eq('month', currentMonth);

    if (usageError) throw usageError;

    // Process subscriptions metrics
    let activeSubs = 0;
    let trialSubs = 0;
    let expiredSubs = 0;
    const planBreakdown: Record<string, number> = {};

    subs?.forEach((s: Record<string, unknown>) => {
      if (s.status === 'active') activeSubs++;
      else if (s.status === 'trial') trialSubs++;
      else expiredSubs++;

      const planObj = Array.isArray(s.plan) ? s.plan[0] : s.plan;
      const planName = planObj?.name || 'Unknown';
      planBreakdown[planName] = (planBreakdown[planName] || 0) + 1;
    });

    // Process usage metrics
    let totalAiRequests = 0;
    let totalWhatsappMessages = 0;
    usageData?.forEach(
      (u: { ai_requests: number; whatsapp_messages: number }) => {
        totalAiRequests += u.ai_requests || 0;
        totalWhatsappMessages += u.whatsapp_messages || 0;
      }
    );

    return NextResponse.json({
      totalAccounts: totalAccounts ?? 0,
      totalContacts: totalContacts ?? 0,
      totalUsers: totalUsers ?? 0,
      subscriptions: {
        active: activeSubs,
        trial: trialSubs,
        expired: expiredSubs,
        total: subs?.length ?? 0,
        planBreakdown,
      },
      usage: {
        month: currentMonth,
        aiRequests: totalAiRequests,
        whatsappMessages: totalWhatsappMessages,
      },
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/metrics] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
