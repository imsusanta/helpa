import { NextResponse } from 'next/server';
import { LeadStageType } from '@/core/types';
import { TrustedActionExecutor } from '@/core/actions/action-executor';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';

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
    const body = await request.json().catch(() => ({}));
    const {
      nextStage,
      reason,
      accountId = 'default_account',
      actorId = 'system',
    } = body as {
      nextStage: LeadStageType;
      reason?: string;
      accountId?: string;
      actorId?: string;
    };

    if (!nextStage || !ALLOWED_STAGES.includes(nextStage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported target stage.' },
        { status: 400 }
      );
    }

    const executor = new TrustedActionExecutor({
      accountId,
      actorId,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return POST(request, context);
}
