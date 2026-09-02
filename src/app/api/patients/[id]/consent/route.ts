import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { toErrorResponse } from '@/lib/auth/account';
import { requireHealthWorkplace } from '@/lib/auth/industry';
import { logger } from '@/lib/observability/logger';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate and authorize — derive identity from server session in Health workplace
    const ctx = await requireHealthWorkplace('admin');
    const accountId = ctx.accountId;
    const actorId = ctx.userId;

    const { id: patientId } = await params;
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!patientId || !UUID_REGEX.test(patientId)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      consent_status?: string;
      consent_source?: string;
      policy_version?: string;
    };

    const {
      consent_status,
      consent_source = 'web_dashboard',
      policy_version = 'v1.0',
    } = body;

    if (
      !consent_status ||
      !['opted_in', 'opted_out', 'pending'].includes(consent_status)
    ) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid consent_status. Must be one of: pending, opted_in, opted_out',
        },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const db = getAdminClient();

    // 2. Atomic consent update + audit via RPC (scoped by server-derived accountId)
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      'update_patient_consent_atomic',
      {
        p_patient_id: patientId,
        p_account_id: accountId,
        p_actor_id: actorId,
        p_consent_status: consent_status,
        p_consent_source: consent_source,
        p_policy_version: policy_version,
      }
    );

    if (rpcErr) {
      // Check for specific error messages from the RPC
      if (rpcErr.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404, headers: CACHE_HEADERS }
        );
      }
      logger.error('Consent update RPC failed', {
        component: 'consent-api',
        accountId,
        correlationId: patientId,
      });
      return NextResponse.json(
        { error: 'Failed to update consent record' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        consent: {
          patient_id: patientId,
          consent_status,
          consent_source,
          policy_version,
          updated_at: rpcResult?.updated_at || new Date().toISOString(),
        },
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
