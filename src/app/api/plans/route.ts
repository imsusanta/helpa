import { NextResponse } from 'next/server';

import { appwriteAdmin } from '@/lib/appwrite-compat';

export const dynamic = 'force-dynamic';

/**
 * The public landing page only needs plan information that an admin has
 * already made visible in the pricing table. Keep management endpoints
 * protected under /api/admin/plans and expose this intentionally limited read.
 */
export async function GET() {
  try {
    const { data, error } = await appwriteAdmin()
      .from('plans')
      .select(
        'id, name, monthly_price, yearly_price, max_users, max_contacts, max_whatsapp_numbers, max_ai_requests, features'
      )
      .order('monthly_price', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? [], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[GET /api/plans] error:', error);
    return NextResponse.json(
      { error: 'Unable to load plans right now.' },
      { status: 500 }
    );
  }
}
