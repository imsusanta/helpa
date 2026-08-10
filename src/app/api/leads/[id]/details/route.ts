import { NextResponse } from 'next/server';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || 'default_account';

    const lead = await leadsRepository.getLead(accountId, leadId);

    if (!lead) {
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
        role: 'owner',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error.' },
      { status: 500 }
    );
  }
}
