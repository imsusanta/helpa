import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { logger } from '@/lib/observability/logger';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate and authorize — derive identity from server session
    const ctx = await requireRole('admin');
    const accountId = ctx.accountId;
    const actorId = ctx.userId;

    const { id: patientId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };

    const { reason = 'patient_opted_out' } = body;

    const db = supabaseAdmin();

    // 2. Atomic withdrawal via RPC (scoped by server-derived accountId)
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      'update_patient_consent_atomic',
      {
        p_patient_id: patientId,
        p_account_id: accountId,
        p_actor_id: actorId,
        p_consent_status: 'opted_out',
        p_consent_source: 'optout_request',
        p_policy_version: 'v1.0',
      }
    );

    if (rpcErr) {
      if (rpcErr.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404, headers: CACHE_HEADERS }
        );
      }
      logger.error('Consent withdrawal RPC failed', {
        component: 'withdrawal-api',
        accountId,
        correlationId: patientId,
      });
      return NextResponse.json(
        { error: 'Failed to record consent withdrawal' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    logger.info('Patient consent withdrawn', {
      component: 'withdrawal-api',
      accountId,
      correlationId: patientId,
    });

    return NextResponse.json(
      {
        success: true,
        consent: {
          patient_id: patientId,
          consent_status: 'opted_out',
          reason,
          updated_at: rpcResult?.updated_at || new Date().toISOString(),
        },
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
