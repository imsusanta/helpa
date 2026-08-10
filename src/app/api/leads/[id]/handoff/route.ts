import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { TrustedActionExecutor } from '@/core/actions/action-executor';

export async function POST(
  request: Request,
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
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const adminDb = supabaseAdmin();
    const { data: deal, error: dealErr } = await adminDb
      .from('deals')
      .select('id, account_id, contact_id')
      .eq('id', leadId)
      .single();

    if (dealErr || !deal) {
      return NextResponse.json(
        { success: false, error: 'Lead not found.' },
        { status: 404 }
      );
    }

    // Find conversation linked to contact
    let conversationId = '';
    if (deal.contact_id) {
      const { data: conv } = await adminDb
        .from('conversations')
        .select('id')
        .eq('account_id', deal.account_id)
        .eq('contact_id', deal.contact_id)
        .maybeSingle();

      conversationId = conv?.id || '';
    }

    if (!conversationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active conversation found for this lead.',
        },
        { status: 400 }
      );
    }

    const executor = new TrustedActionExecutor({
      accountId: deal.account_id,
      actorId: user.id,
      actorType: 'user',
    });

    const result = await executor.handoffToHuman({
      conversationId,
      reason: 'Manual takeover requested from Lead Details drawer',
      leadId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error' },
      { status: 500 }
    );
  }
}
