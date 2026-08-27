import { NextRequest, NextResponse } from 'next/server';
import {
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

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

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trip-proposals/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: proposal, error } = await supabase
      .from('trip_proposals')
      .select(
        '*, contacts(id, name, phone, email), travel_packages(id, name, destination, duration_days, price, description)'
      )
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error) {
      console.error('[trip-proposals/:id] GET query failed:', error);
      return errorResponse(500, 'FETCH_FAILED', correlationId, error.message);
    }

    if (!proposal) {
      return errorResponse(
        404,
        'NOT_FOUND',
        correlationId,
        'Trip proposal not found.'
      );
    }

    return NextResponse.json(
      { success: true, data: proposal },
      { status: 200, headers: PRIVATE_HEADERS }
    );
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        correlationId,
        'Authentication required'
      );
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'FORBIDDEN', correlationId, error.message);
    }
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'An error occurred.'
    );
  }
}

/**
 * PATCH /api/trip-proposals/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'contact_id',
      'package_id',
      'title',
      'destination',
      'duration_days',
      'duration_nights',
      'start_date',
      'end_date',
      'adults_count',
      'children_count',
      'base_price',
      'tax_amount',
      'discount_amount',
      'inclusions',
      'exclusions',
      'itinerary',
      'hotel_details',
      'transport_details',
      'notes',
      'terms',
      'status',
      'valid_until',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (
      body.base_price !== undefined ||
      body.tax_amount !== undefined ||
      body.discount_amount !== undefined
    ) {
      const base = Number(body.base_price ?? 0);
      const tax = Number(body.tax_amount ?? 0);
      const discount = Number(body.discount_amount ?? 0);
      updatePayload.total_price = Math.max(0, base + tax - discount);
    }

    const { data: updated, error } = await supabase
      .from('trip_proposals')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts(id, name, phone, email)')
      .single();

    if (error) {
      console.error('[trip-proposals/:id] PATCH update failed:', error);
      return errorResponse(500, 'UPDATE_FAILED', correlationId, error.message);
    }

    return NextResponse.json(
      {
        success: true,
        data: updated,
        message: 'Trip proposal updated successfully.',
      },
      { status: 200, headers: PRIVATE_HEADERS }
    );
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        correlationId,
        'Authentication required'
      );
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'FORBIDDEN', correlationId, error.message);
    }
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'An error occurred.'
    );
  }
}

/**
 * DELETE /api/trip-proposals/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('trip_proposals')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[trip-proposals/:id] DELETE failed:', error);
      return errorResponse(500, 'DELETE_FAILED', correlationId, error.message);
    }

    return NextResponse.json(
      { success: true, message: 'Trip proposal deleted successfully.' },
      { status: 200, headers: PRIVATE_HEADERS }
    );
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        correlationId,
        'Authentication required'
      );
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'FORBIDDEN', correlationId, error.message);
    }
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'An error occurred.'
    );
  }
}
