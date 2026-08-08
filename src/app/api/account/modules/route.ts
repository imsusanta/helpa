import { NextResponse } from 'next/server';
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    const { data, error } = await ctx.supabase
      .from('tenant_modules')
      .select('module_key, enabled, settings')
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[GET /api/account/modules] fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to load tenant modules' },
        { status: 500 }
      );
    }

    return NextResponse.json({ modules: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    // Only admins or owners can enable/disable workspace modules
    const ctx = await requireRole('admin');
    const body = await request.json();
    const { module_key, enabled, settings } = body;

    if (!module_key) {
      return NextResponse.json(
        { error: 'module_key parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabase
      .from('tenant_modules')
      .upsert(
        {
          account_id: ctx.accountId,
          module_key,
          enabled: !!enabled,
          settings: settings || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id, module_key' }
      )
      .select()
      .single();

    if (error) {
      console.error('[POST /api/account/modules] upsert error:', error);
      return NextResponse.json(
        { error: 'Failed to update tenant module' },
        { status: 500 }
      );
    }

    return NextResponse.json({ module: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
