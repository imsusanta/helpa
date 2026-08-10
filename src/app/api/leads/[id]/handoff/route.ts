import { NextResponse } from 'next/server';
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
    const body = await request.json().catch(() => ({}));
    const {
      accountId = 'default_account',
      actorId = 'system',
      conversationId = leadId,
    } = body;

    const executor = new TrustedActionExecutor({
      accountId,
      actorId,
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
