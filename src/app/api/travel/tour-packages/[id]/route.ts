import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { requireTravelWorkplace } from '@/lib/travel/access';
import {
  deleteTourPackage,
  getTourPackageDetail,
  setTourPackageStatus,
  updateTourPackage,
} from '@/lib/travel/retrieval';
import type { TourPackageWriteInput } from '@/lib/travel/types';

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
    const ctx = await requireTravelWorkplace('viewer');
    const { id } = await params;
    const data = await getTourPackageDetail(ctx.admin, ctx.accountId, id);
    if (!data)
      return errorResponse(404, 'TOUR_PACKAGE_NOT_FOUND', correlationId);
    return NextResponse.json(
      { success: true, data, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'TRAVEL_WORKPLACE_REQUIRED', correlationId);
    }
    return errorResponse(
      500,
      'TOUR_PACKAGE_GET_FAILED',
      correlationId,
      'Unable to load the tour package.'
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireTravelWorkplace('agent');
    const { id } = await params;
    const body = (await request.json()) as TourPackageWriteInput & {
      statusOnly?: boolean;
    };

    if (
      body.statusOnly &&
      (body.status === 'active' || body.status === 'inactive')
    ) {
      const updated = await setTourPackageStatus(
        ctx.admin,
        ctx.accountId,
        id,
        body.status
      );
      if (!updated) {
        return errorResponse(404, 'TOUR_PACKAGE_NOT_FOUND', correlationId);
      }
      return NextResponse.json(
        { success: true, data: updated, requestId: correlationId },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    const updated = await updateTourPackage(ctx.admin, ctx.accountId, id, body);
    if (!updated) {
      return errorResponse(404, 'TOUR_PACKAGE_NOT_FOUND', correlationId);
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
      return errorResponse(403, 'TRAVEL_WORKPLACE_REQUIRED', correlationId);
    }
    const code =
      err instanceof Error ? err.message : 'TOUR_PACKAGE_SAVE_FAILED';
    if (code === 'PACKAGE_PARTY_SIZE_INVALID') {
      return errorResponse(
        400,
        code,
        correlationId,
        'Party size must be at least 1, and max must be at least min.'
      );
    }
    return errorResponse(
      500,
      'TOUR_PACKAGE_SAVE_FAILED',
      correlationId,
      'Unable to update the tour package.'
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireTravelWorkplace('admin');
    const { id } = await params;
    const deleted = await deleteTourPackage(ctx.admin, ctx.accountId, id);
    if (!deleted) {
      return errorResponse(404, 'TOUR_PACKAGE_NOT_FOUND', correlationId);
    }
    return NextResponse.json(
      { success: true, data: { id }, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'TRAVEL_WORKPLACE_REQUIRED', correlationId);
    }
    return errorResponse(
      500,
      'TOUR_PACKAGE_DELETE_FAILED',
      correlationId,
      'Unable to delete the tour package.'
    );
  }
}
