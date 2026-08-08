import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { logger } from '@/lib/observability/logger';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate and authorize — only owner can permanently delete patient data
    const ctx = await requireRole('owner');
    const accountId = ctx.accountId;
    const actorId = ctx.userId;

    const { id: patientId } = await params;

    const db = supabaseAdmin();

    // 2. Verify patient exists and belongs to the authenticated tenant
    const { data: patient, error: fetchErr } = await db
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (fetchErr || !patient) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // 3. Record audit BEFORE deletion (since patient row will be gone after)
    const { error: auditErr } = await db.from('audit_logs').insert({
      account_id: accountId,
      actor_id: actorId,
      action: 'patient.data_deleted',
      resource_type: 'patients',
      resource_id: patientId,
      metadata: {
        deleted_at: new Date().toISOString(),
      },
    });

    if (auditErr) {
      logger.error('Failed to record deletion audit event', {
        component: 'delete-api',
        accountId,
        correlationId: patientId,
      });
      // Fail — unaudited deletions are not acceptable
      return NextResponse.json(
        { error: 'Deletion audit recording failed' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    // 4. Execute deletion scoped by account_id
    const { error: deleteErr } = await db
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('account_id', accountId);

    if (deleteErr) {
      logger.error('Patient deletion failed', {
        component: 'delete-api',
        accountId,
        correlationId: patientId,
      });
      return NextResponse.json(
        { error: 'Failed to delete patient record' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    logger.info('Patient data deleted', {
      component: 'delete-api',
      accountId,
      correlationId: patientId,
    });

    return NextResponse.json(
      { success: true },
      { headers: CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
