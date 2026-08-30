import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { requireTravelWorkplace } from '@/lib/travel/access';
import { createTourPackage, listTourPackages } from '@/lib/travel/retrieval';
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireTravelWorkplace('viewer');
    const { searchParams } = request.nextUrl;
    const data = await listTourPackages(ctx.admin, ctx.accountId, {
      search: searchParams.get('search') || undefined,
      destination: searchParams.get('destination') || undefined,
      status: searchParams.get('status') || undefined,
      packageType: searchParams.get('package_type') || undefined,
      limit: Math.min(
        200,
        Math.max(1, parseInt(searchParams.get('limit') || '100', 10))
      ),
    });
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
      'TOUR_PACKAGES_FETCH_FAILED',
      correlationId,
      'Unable to load tour packages.'
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireTravelWorkplace('agent');
    const body = (await request.json()) as TourPackageWriteInput;
    const created = await createTourPackage(ctx.admin, ctx.accountId, body);
    return NextResponse.json(
      { success: true, data: created, requestId: correlationId },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
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
    if (
      code === 'PACKAGE_NAME_REQUIRED' ||
      code === 'PACKAGE_DESTINATION_REQUIRED'
    ) {
      return errorResponse(
        400,
        code,
        correlationId,
        'Package name and destination are required.'
      );
    }
    return errorResponse(
      500,
      'TOUR_PACKAGE_SAVE_FAILED',
      correlationId,
      'Unable to save the tour package.'
    );
  }
}
