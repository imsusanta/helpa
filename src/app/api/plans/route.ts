import { NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { DEFAULT_PLANS } from '@/core/billing/plans';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let plans: Array<Record<string, unknown>> = [];
    try {
      const { data, error } = await appwriteAdmin().from('plans').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        plans = data as Array<Record<string, unknown>>;
      }
    } catch (e) {
      console.warn('[GET /api/plans] soft error fetching plans:', e);
    }

    if (plans.length === 0) {
      plans = DEFAULT_PLANS.filter((p) => p.id !== 'plan_free').map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        monthly_price: p.monthlyPrice,
        yearly_price: p.yearlyPrice,
        max_users: p.usageLimits.teamMembers,
        max_contacts: p.usageLimits.contacts,
        max_whatsapp_numbers:
          p.id === 'plan_business' ? 5 : p.id === 'plan_professional' ? 2 : 1,
        max_ai_requests: p.usageLimits.aiMessages,
        features: p.features,
      }));
    }

    plans.sort((a, b) => {
      const pA = Number(a.monthly_price || a.monthlyPrice || 0);
      const pB = Number(b.monthly_price || b.monthlyPrice || 0);
      return pA - pB;
    });

    return NextResponse.json(plans, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[GET /api/plans] error:', error);
    return NextResponse.json([], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
}
