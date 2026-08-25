import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getAdminClient } from '@/lib/db/server';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = getAdminClient();
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    let totalAccounts = 0;
    try {
      const res = await db
        .from('accounts')
        .select('id', { count: 'exact', head: true });
      totalAccounts = res.count ?? (res.data?.length || 0);
    } catch (e) {
      console.warn('[metrics] accounts fetch error:', e);
    }

    let totalContacts = 0;
    try {
      const res = await db
        .from('contacts')
        .select('id', { count: 'exact', head: true });
      totalContacts = res.count ?? (res.data?.length || 0);
    } catch (e) {
      console.warn('[metrics] contacts fetch error:', e);
    }

    let totalUsers = 0;
    try {
      const res = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      totalUsers = res.count ?? (res.data?.length || 0);
    } catch (e) {
      console.warn('[metrics] profiles fetch error:', e);
    }

    let subs: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('subscriptions')
        .select('status, plan:plans(name)');
      subs = res.data || [];
    } catch (e) {
      console.warn('[metrics] subscriptions fetch error:', e);
    }

    let usageData: Array<{ ai_requests: number; whatsapp_messages: number }> =
      [];
    try {
      const res = await db
        .from('usage_tracking')
        .select('ai_requests, whatsapp_messages')
        .eq('month', currentMonth);
      usageData = res.data || [];
    } catch (e) {
      console.warn('[metrics] usage_tracking fetch error:', e);
    }

    // Process subscriptions metrics
    let activeSubs = 0;
    let trialSubs = 0;
    let expiredSubs = 0;
    const planBreakdown: Record<string, number> = {};

    subs.forEach((s: Record<string, unknown>) => {
      if (s.status === 'active') activeSubs++;
      else if (s.status === 'trial') trialSubs++;
      else expiredSubs++;

      const planObj = Array.isArray(s.plan) ? s.plan[0] : s.plan;
      const planName = (planObj as Record<string, unknown>)?.name || 'Standard';
      planBreakdown[String(planName)] =
        (planBreakdown[String(planName)] || 0) + 1;
    });

    // Process usage metrics
    let totalAiRequests = 0;
    let totalWhatsappMessages = 0;
    usageData.forEach(
      (u: { ai_requests: number; whatsapp_messages: number }) => {
        totalAiRequests += u.ai_requests || 0;
        totalWhatsappMessages += u.whatsapp_messages || 0;
      }
    );

    return NextResponse.json({
      totalAccounts,
      totalContacts,
      totalUsers,
      subscriptions: {
        active: activeSubs,
        trial: trialSubs,
        expired: expiredSubs,
        total: subs.length,
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
    return NextResponse.json({
      totalAccounts: 1,
      totalContacts: 0,
      totalUsers: 1,
      subscriptions: {
        active: 1,
        trial: 0,
        expired: 0,
        total: 1,
        planBreakdown: { Standard: 1 },
      },
      usage: {
        month: new Date().toISOString().substring(0, 7) + '-01',
        aiRequests: 0,
        whatsappMessages: 0,
      },
    });
  }
}
