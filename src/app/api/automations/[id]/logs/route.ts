import { NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const context = await requireRole('viewer');
    const admin = appwriteAdmin();
    const { data: automation, error: automationError } = await admin
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .maybeSingle();

    if (automationError) throw automationError;
    if (!automation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: logs, error: logsError } = await admin
      .from('automation_logs')
      .select('*, contact:contacts(id, name, phone)')
      .eq('automation_id', id)
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (logsError) throw logsError;

    return NextResponse.json(
      { automation, logs: logs ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
