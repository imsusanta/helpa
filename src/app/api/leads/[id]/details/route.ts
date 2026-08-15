import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  if (!leadId) {
    return NextResponse.json(
      { success: false, error: 'Lead ID is required.' },
      { status: 400 }
    );
  }

  try {
    const ctx = await getCurrentAccount();
    const supabase = getSupabaseAdminClient();
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        lead,
        consents: [],
        appointments: [],
        stageHistory: [],
        notes: [],
        calls: [],
        conversation: null,
        messages: [],
        followups: [],
        role: ctx.role || 'owner',
      },
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
