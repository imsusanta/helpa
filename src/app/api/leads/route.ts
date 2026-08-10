import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const leads = await leadsRepository.listLeads(ctx.accountId);

    return NextResponse.json({
      success: true,
      data: leads,
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
