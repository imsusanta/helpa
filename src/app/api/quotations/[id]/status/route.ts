import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { dispatchCrmEvent } from '@/core/events';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  correlationId: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message || code,
      requestId: correlationId,
    },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { status } = body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(
        400,
        'INVALID_STATUS',
        correlationId,
        `Valid statuses: ${VALID_STATUSES.join(', ')}`
      );
    }

    const { data: updated, error } = await supabase
      .from('quotations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts(id, name, phone, email), quotation_items(*)')
      .single();

    if (error || !updated) {
      console.error('[quotations] status update error:', {
        requestId: correlationId,
        code: error?.code,
        message: error?.message,
      });
      return errorResponse(
        500,
        'STATUS_UPDATE_FAILED',
        correlationId,
        'Unable to update quotation status.'
      );
    }

    try {
      await dispatchCrmEvent({
        accountId: ctx.accountId,
        eventType: 'deal.updated',
        payload: {
          quotationId: id,
          newStatus: status,
          contactId: updated.contact_id,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      { success: true, data: updated, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[quotations] status update unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'STATUS_UPDATE_FAILED',
      correlationId,
      'Unable to update quotation status.'
    );
  }
}
