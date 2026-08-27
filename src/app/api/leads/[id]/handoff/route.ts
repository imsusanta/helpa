import { NextResponse } from 'next/server';
import { TrustedActionExecutor } from '@/core/actions/action-executor';
import { pauseFollowupsForConversation } from '@/lib/leads/lead-followup.service';
import { getAdminClient } from '@/lib/db/server';
import {
  ForbiddenError,
  requireRole,
  toErrorResponse,
  UnauthorizedError,
} from '@/lib/auth/account';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.length > 0
        ? body.conversationId
        : leadId;

    const executor = new TrustedActionExecutor({
      accountId: ctx.accountId,
      actorId: ctx.userId,
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

    try {
      await pauseFollowupsForConversation(getAdminClient(), {
        accountId: ctx.accountId,
        conversationId,
        leadId,
      });
    } catch (err) {
      console.error('[leads] pause follow-ups on handoff failed', err);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      return toErrorResponse(err);
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error' },
      { status: 500 }
    );
  }
}
