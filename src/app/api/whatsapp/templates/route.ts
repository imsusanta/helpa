import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * GET /api/whatsapp/templates
 *
 * Tenant-scoped message templates query.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const accountCtx = await getCurrentAccount().catch(() => null);
    if (!accountCtx?.accountId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401, headers: PRIVATE_HEADERS }
      );
    }

    const accountId = accountCtx.accountId;
    const dbAdmin = appwriteAdmin();

    const { data: templates, error } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.messageTemplates)
      .select('*')
      .eq('accountId', accountId)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[GET /api/whatsapp/templates] DB Query Error:', error);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to load templates' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: templates || [] },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    console.error('[GET /api/whatsapp/templates] Internal Error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
