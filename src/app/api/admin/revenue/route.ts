import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { RevenueAnalytics } from '@/core/billing/types';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();

    // Fetch all subscriptions
    const { data: subs } = await db.from('subscriptions').select('*');
    const subscriptions = subs || [];

    let totalRevenue = 0;
    let setupFeeRevenue = 0;
    let recurringRevenue = 0;
    let activeSubscriptionsCount = 0;
    let trialCustomersCount = 0;
    let pastDueCount = 0;
    let cancelledCount = 0;

    const revenueByPlan: Record<string, number> = {
      starter: 0,
      growth: 0,
      pro: 0,
    };

    const customerCountByPlan: Record<string, number> = {
      starter: 0,
      growth: 0,
      pro: 0,
    };

    let totalUpgrades = 0;

    subscriptions.forEach((s) => {
      const status = String(s.status || '').toUpperCase();
      const planSlug = String(s.plan_slug || s.plan_id || 'growth')
        .toLowerCase()
        .replace(/^plan_/, '');
      const setupFee = Number(
        s.setup_fee_amount ||
          (planSlug === 'pro' ? 19999 : planSlug === 'growth' ? 11999 : 7999)
      );
      const monthlyPrice = Number(
        s.monthly_amount ||
          (planSlug === 'pro' ? 7999 : planSlug === 'growth' ? 4999 : 3499)
      );

      if (status === 'ACTIVE') {
        activeSubscriptionsCount++;
        setupFeeRevenue += setupFee;
        recurringRevenue += monthlyPrice;

        customerCountByPlan[planSlug] =
          (customerCountByPlan[planSlug] || 0) + 1;
        revenueByPlan[planSlug] =
          (revenueByPlan[planSlug] || 0) + setupFee + monthlyPrice;
      } else if (status === 'TRIAL' || status === 'TRIALING') {
        trialCustomersCount++;
      } else if (status === 'PAST_DUE') {
        pastDueCount++;
      } else if (status === 'CANCELLED' || status === 'EXPIRED') {
        cancelledCount++;
      }

      if (s.was_upgraded) {
        totalUpgrades++;
      }
    });

    totalRevenue = setupFeeRevenue + recurringRevenue;
    const totalCustomers = subscriptions.length || 1;
    const upgradeRate = Math.round((totalUpgrades / totalCustomers) * 100);
    const cancellationRate = Math.round(
      (cancelledCount / totalCustomers) * 100
    );

    const analytics: RevenueAnalytics = {
      totalRevenue,
      setupFeeRevenue,
      recurringRevenue,
      monthlyRecurringRevenue: recurringRevenue,
      activeSubscriptionsCount,
      trialCustomersCount,
      pastDueCount,
      cancelledCount,
      revenueByPlan: {
        starter: revenueByPlan.starter || 0,
        growth: revenueByPlan.growth || 0,
        pro: revenueByPlan.pro || 0,
      },
      customerCountByPlan: {
        starter: customerCountByPlan.starter || 0,
        growth: customerCountByPlan.growth || 0,
        pro: customerCountByPlan.pro || 0,
      },
      upgradeRate,
      cancellationRate,
    };

    // Fetch recent platform payment transactions
    const { data: recentPayments } = await db
      .from('platform_payments')
      .select('*, account:accounts(id, name)')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      ...analytics,
      recentPayments: recentPayments || [],
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/revenue] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
