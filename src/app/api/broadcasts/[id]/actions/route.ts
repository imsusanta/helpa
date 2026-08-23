import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * Campaign lifecycle actions with an explicit state machine.
 *
 * pause:     scheduled → paused  (stops the cron dispatcher from picking it up)
 * resume:    paused → scheduled  (due immediately when scheduled_at has passed)
 * cancel:    scheduled → draft   (spec: "Scheduled: Edit, Cancel")
 * duplicate: any non-sending state → fresh draft copy with zeroed counters
 *
 * Deliberately unsupported actions return 409 rather than pretending:
 * - pausing a 'sending' broadcast cannot stop the in-flight dispatch loop
 * - retrying failed recipients has no safe server-side re-dispatch yet
 */
const ALLOWED_TRANSITIONS: Record<string, { from: string[] }> = {
  pause: { from: ['scheduled'] },
  resume: { from: ['paused'] },
  cancel: { from: ['scheduled'] },
  duplicate: {
    from: ['draft', 'scheduled', 'sent', 'failed', 'paused'],
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    let action = '';
    try {
      const body = await request.json();
      action = typeof body?.action === 'string' ? body.action : '';
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const transition = ALLOWED_TRANSITIONS[action];
    if (!transition) {
      return NextResponse.json(
        { error: `Unsupported action: ${action || '(none)'}` },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    // Tenant-scoped fetch — id alone never grants access.
    const { data: broadcast, error: fetchError } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();

    if (fetchError || !broadcast) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const currentStatus = String(broadcast.status);

    if (currentStatus === 'sending') {
      return NextResponse.json(
        { error: 'Campaign is currently sending and cannot be modified' },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }

    if (!transition.from.includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot ${action} a campaign in "${currentStatus}" status`,
        },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === 'pause') {
      const { data, error } = await supabase
        .from('broadcasts')
        .update({ status: 'paused', paused_at: nowIso, updated_at: nowIso })
        .eq('id', id)
        .eq('account_id', context.accountId)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: PRIVATE_HEADERS }
        );
      }
      return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
    }

    if (action === 'resume') {
      // If the original schedule already passed, make it due immediately
      // so the cron dispatcher picks it up on the next tick.
      const scheduledAt = broadcast.scheduled_at
        ? new Date(String(broadcast.scheduled_at))
        : null;
      const due =
        scheduledAt && !Number.isNaN(scheduledAt.getTime())
          ? scheduledAt.toISOString()
          : nowIso;
      const effectiveDue = due <= nowIso ? nowIso : due;

      const { data, error } = await supabase
        .from('broadcasts')
        .update({
          status: 'scheduled',
          scheduled_at: effectiveDue,
          paused_at: null,
          updated_at: nowIso,
        })
        .eq('id', id)
        .eq('account_id', context.accountId)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: PRIVATE_HEADERS }
        );
      }
      return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
    }

    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('broadcasts')
        .update({ status: 'draft', scheduled_at: null, updated_at: nowIso })
        .eq('id', id)
        .eq('account_id', context.accountId)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: PRIVATE_HEADERS }
        );
      }
      return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
    }

    // action === 'duplicate'
    const copyFields = [
      'name',
      'template_name',
      'template_language',
      'template_variables',
      'audience_filter',
      'category',
      'message_body',
      'message',
      'attachment_url',
      'attachment_type',
      'cta_type',
      'cta_text',
      'cta_url',
      'recurrence',
    ] as const;

    const clone: Record<string, unknown> = {
      account_id: context.accountId,
      user_id: context.userId,
      created_by: context.userId,
      name: `${broadcast.name} (Copy)`.slice(0, 200),
      status: 'draft',
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
      scheduled_at: null,
      updated_at: nowIso,
    };
    for (const field of copyFields) {
      if (broadcast[field] !== null && broadcast[field] !== undefined) {
        clone[field] = broadcast[field];
      }
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert(clone)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
