import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { requireTravelWorkplace } from '@/lib/travel/access';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  presentQuotation,
  QUOTATION_ITEMS_FK,
} from '@/lib/sales/quotation-presenter';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireTravelWorkplace('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: quotation, error } = await supabase
      .from('quotations')
      .select(
        `*, contacts(id, name, phone, email, metadata), ${QUOTATION_ITEMS_FK}(*)`
      )
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error || !quotation) {
      return errorResponse(
        404,
        'QUOTATION_NOT_FOUND',
        correlationId,
        'Quotation not found.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: presentQuotation(quotation),
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error('[quotations] GET by id error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'QUOTATION_FETCH_FAILED',
      correlationId,
      'Unable to load quotation.'
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireTravelWorkplace('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[quotations] DELETE error:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'QUOTATION_DELETE_FAILED',
        correlationId,
        'Unable to delete quotation.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Quotation deleted successfully',
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[quotations] DELETE unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'QUOTATION_DELETE_FAILED',
      correlationId,
      'Unable to delete quotation.'
    );
  }
}
