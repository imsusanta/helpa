import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { logger } from '@/lib/observability/logger';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

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

    // Rate limit check: 5/min per user
    const rl = checkRateLimit(`delete:${actorId}`, RATE_LIMITS.patientDelete);
    if (!rl.success) return rateLimitResponse(rl);

    const { id: patientId } = await params;
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!patientId || !UUID_REGEX.test(patientId)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const db = supabaseAdmin();

    // 2. Atomic deletion + audit event within a single PostgreSQL transaction via RPC
    const { error: rpcErr } = await db.rpc('delete_patient_atomic', {
      p_patient_id: patientId,
      p_account_id: accountId,
      p_actor_id: actorId,
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404, headers: CACHE_HEADERS }
        );
      }
      logger.error('Patient deletion RPC failed', {
        component: 'delete-api',
        accountId,
        correlationId: patientId,
      });
      return NextResponse.json(
        { error: 'Failed to delete patient record' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    logger.info('Patient data deleted atomically', {
      component: 'delete-api',
      accountId,
      correlationId: patientId,
    });

    return NextResponse.json({ success: true }, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
