import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      planId?: string;
      planName?: string;
    } | null;

    const planName = body?.planName || body?.planId || 'Growth';
    const supabase = getSupabaseAdminClient();
    const nextEndDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    // Check existing subscription
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('account_id', ctx.accountId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          end_date: nextEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('subscriptions').insert({
        account_id: ctx.accountId,
        status: 'active',
        end_date: nextEndDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Subscription upgraded to ${planName} Plan successfully!`,
      planName,
      status: 'active',
      endDate: nextEndDate,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
