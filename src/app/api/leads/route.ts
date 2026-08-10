import { NextResponse } from 'next/server';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || 'default_account';

    const leads = await leadsRepository.listLeads(accountId);

    return NextResponse.json({
      success: true,
      data: leads,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || 'Failed to fetch leads.',
      },
      { status: 500 }
    );
  }
}
