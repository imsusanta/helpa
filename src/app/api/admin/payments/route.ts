import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getAdminClient } from '@/lib/db/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = getAdminClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200);

    // Fetch payments with joined accounts
    const { data: payments, error } = await db
      .from('platform_payments')
      .select('*, account:accounts(id, name, industry)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Fallback if joined accounts is not supported by underlying mock
      const { data: rawPayments } = await db
        .from('platform_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      return NextResponse.json(rawPayments || []);
    }

    return NextResponse.json(payments || []);
  } catch (err: unknown) {
    console.error('[GET /api/admin/payments] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
