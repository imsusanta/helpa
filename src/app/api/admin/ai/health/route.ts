import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getProviderInstance } from '@/core/ai/provider';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const openRouter = getProviderInstance('openrouter');
    const orcaRouter = getProviderInstance('orcarouter');

    const [openHealth, orcaHealth] = await Promise.all([
      openRouter.healthCheck(),
      orcaRouter.healthCheck(),
    ]);

    return NextResponse.json({
      openrouter: openHealth,
      orcarouter: orcaHealth,
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/ai/health] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
