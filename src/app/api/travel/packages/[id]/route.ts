import { NextRequest, NextResponse } from 'next/server';
import {
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import {
  getPackageWithDetails,
  updatePackage,
  archivePackage,
  publishPackage,
  safeDeletePackage,
  type UpdateTourPackageInput,
} from '@/modules/travel/package-service';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

const VALID_STATUSES = ['draft', 'published', 'sold_out', 'archived'];
const VALID_PRICE_BASIS = ['per_person', 'per_couple', 'per_group'];

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

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/travel/packages/[id]
 * Get a single package with itinerary and departures.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const { id } = await params;

    const pkg = await getPackageWithDetails(ctx.accountId, id);
    if (!pkg) {
      return errorResponse(
        404,
        'NOT_FOUND',
        correlationId,
        'Package not found'
      );
    }

    return NextResponse.json(
      { success: true, data: pkg, requestId: correlationId },
      {
        status: 200,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError)
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    if (err instanceof ForbiddenError)
      return errorResponse(
        403,
        'PERMISSION_REQUIRED',
        correlationId,
        err.message
      );
    console.error('[travel/packages/[id]] GET error:', err);
    return errorResponse(500, 'INTERNAL_SERVER_ERROR', correlationId);
  }
}

/**
 * PATCH /api/travel/packages/[id]
 * Update a package, or perform lifecycle actions (publish/archive).
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;

    const limit = checkRateLimit(
      `agent:travel-pkg-update:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return errorResponse(
        400,
        'INVALID_BODY',
        correlationId,
        'Invalid JSON request body'
      );
    }

    // Lifecycle actions
    if (body.action === 'publish') {
      await publishPackage(ctx.accountId, id, ctx.userId);
      const updated = await getPackageWithDetails(ctx.accountId, id);
      return NextResponse.json(
        { success: true, data: updated, requestId: correlationId },
        {
          status: 200,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    if (body.action === 'archive') {
      await archivePackage(ctx.accountId, id, ctx.userId);
      const updated = await getPackageWithDetails(ctx.accountId, id);
      return NextResponse.json(
        { success: true, data: updated, requestId: correlationId },
        {
          status: 200,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    // Field validation
    if (
      body.base_price !== undefined &&
      body.base_price !== null &&
      (typeof body.base_price !== 'number' || body.base_price < 0)
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'Base price cannot be negative'
      );
    }
    if (
      body.duration_days !== undefined &&
      (typeof body.duration_days !== 'number' || body.duration_days < 1)
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'Duration (days) must be at least 1'
      );
    }
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        `Status must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }
    if (
      body.price_basis !== undefined &&
      body.price_basis !== null &&
      !VALID_PRICE_BASIS.includes(body.price_basis)
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        `Price basis must be one of: ${VALID_PRICE_BASIS.join(', ')}`
      );
    }
    if (
      body.valid_from &&
      body.valid_until &&
      body.valid_until < body.valid_from
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'valid_until cannot precede valid_from'
      );
    }

    const input: UpdateTourPackageInput = {};
    if (body.name !== undefined) input.name = body.name;
    if (body.destination !== undefined) input.destination = body.destination;
    if (body.duration_days !== undefined)
      input.duration_days = body.duration_days;
    if (body.duration_nights !== undefined)
      input.duration_nights = body.duration_nights;
    if (body.package_code !== undefined) input.package_code = body.package_code;
    if (body.summary !== undefined) input.summary = body.summary;
    if (body.base_price !== undefined) input.base_price = body.base_price;
    if (body.currency !== undefined) input.currency = body.currency;
    if (body.price_basis !== undefined) input.price_basis = body.price_basis;
    if (body.hotel_details !== undefined)
      input.hotel_details = body.hotel_details;
    if (body.transport_details !== undefined)
      input.transport_details = body.transport_details;
    if (body.inclusions !== undefined) input.inclusions = body.inclusions;
    if (body.exclusions !== undefined) input.exclusions = body.exclusions;
    if (body.terms_and_conditions !== undefined)
      input.terms_and_conditions = body.terms_and_conditions;
    if (body.booking_deadline !== undefined)
      input.booking_deadline = body.booking_deadline;
    if (body.valid_from !== undefined) input.valid_from = body.valid_from;
    if (body.valid_until !== undefined) input.valid_until = body.valid_until;
    if (body.status !== undefined) input.status = body.status;
    if (body.metadata !== undefined) input.metadata = body.metadata;
    if (body.itinerary !== undefined) input.itinerary = body.itinerary;
    if (body.departures !== undefined) input.departures = body.departures;

    await updatePackage(ctx.accountId, id, ctx.userId, input);
    const fullPkg = await getPackageWithDetails(ctx.accountId, id);

    return NextResponse.json(
      { success: true, data: fullPkg, requestId: correlationId },
      {
        status: 200,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError)
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    if (err instanceof ForbiddenError)
      return errorResponse(
        403,
        'PERMISSION_REQUIRED',
        correlationId,
        err.message
      );
    console.error('[travel/packages/[id]] PATCH error:', err);
    return errorResponse(500, 'INTERNAL_SERVER_ERROR', correlationId);
  }
}

/**
 * DELETE /api/travel/packages/[id]
 * Safely delete (or archive if referenced) a package.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;

    const limit = checkRateLimit(
      `agent:travel-pkg-delete:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const result = await safeDeletePackage(ctx.accountId, id, ctx.userId);

    return NextResponse.json(
      {
        success: true,
        deleted: result.deleted,
        archived: result.archived,
        message: result.archived
          ? 'Package has bookings/proposals and was archived instead of deleted.'
          : 'Package deleted successfully.',
        requestId: correlationId,
      },
      {
        status: 200,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError)
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    if (err instanceof ForbiddenError)
      return errorResponse(
        403,
        'PERMISSION_REQUIRED',
        correlationId,
        err.message
      );
    console.error('[travel/packages/[id]] DELETE error:', err);
    return errorResponse(500, 'INTERNAL_SERVER_ERROR', correlationId);
  }
}
