import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { LeadStageType } from '@/core/types';
import { AccountRole, canSendMessages } from '@/lib/auth/roles';
import { TrustedActionExecutor } from '@/core/actions/action-executor';

const ALLOWED_STAGES: LeadStageType[] = [
  'NEW',
  'CONTACTED',
  'QUALIFYING',
  'QUALIFIED',
  'APPOINTMENT_OFFERED',
  'BOOKED',
  'CONFIRMED',
  'FOLLOW_UP',
  'ATTENDED',
  'CONVERTED',
  'LOST',
];

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

    const body = await request.json();
    const { nextStage, reason } = body as {
      nextStage: LeadStageType;
      reason?: string;
    };

    if (!nextStage || !ALLOWED_STAGES.includes(nextStage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported target stage.' },
        { status: 400 }
      );
    }

    const adminDb = supabaseAdmin();

    // 1. Fetch deal to verify existence & tenant ownership
    const { data: deal, error: dealErr } = await adminDb
      .from('deals')
      .select('id, account_id, stage, title, contact_id')
      .eq('id', leadId)
      .single();

    if (dealErr || !deal) {
      return NextResponse.json(
        { success: false, error: 'Lead not found.' },
        { status: 404 }
      );
    }

    const accountId = deal.account_id;

    // 2. Verify caller profile & tenancy
    const { data: profile } = await adminDb
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || profile.account_id !== accountId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Cross-tenant access rejected.' },
        { status: 403 }
      );
    }

    // 3. Verify role capability (agent+ can move deals)
    const userRole = (profile.account_role || 'agent') as AccountRole;
    if (!canSendMessages(userRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to update lead stage.',
        },
        { status: 403 }
      );
    }

    // 4. Perform atomic transition via TrustedActionExecutor
    const executor = new TrustedActionExecutor({
      accountId,
      actorId: user.id,
      actorType: 'user',
    });

    const result = await executor.transitionLead({
      leadId,
      nextStage,
      reason,
      source: 'kanban_board',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error.' },
      { status: 500 }
    );
  }
}
