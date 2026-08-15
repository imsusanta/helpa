import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const supabase = getSupabaseAdminClient();
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({
      success: true,
      data: leads || [],
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
