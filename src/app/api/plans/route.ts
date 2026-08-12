import { NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let plans: Array<Record<string, unknown>> = [];
    try {
      const { data, error } = await appwriteAdmin().from('plans').select('*');
      if (!error && Array.isArray(data)) {
        plans = data as Array<Record<string, unknown>>;
      }
    } catch (e) {
      console.warn('[GET /api/plans] soft error fetching plans:', e);
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
