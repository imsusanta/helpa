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
  listPackages,
  createPackage,
  type CreateTourPackageInput,
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

/**
 * GET /api/travel/packages
 * List tour packages for the authenticated account.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status') || undefined;
    const destination = searchParams.get('destination') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listPackages(ctx.accountId, {
      status,
      destination,
      search,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        total: result.total,
        limit,
        offset,
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
    console.error('[travel/packages] GET error:', err);
    return errorResponse(500, 'INTERNAL_SERVER_ERROR', correlationId);
  }
}

/**
 * POST /api/travel/packages
 * Create a new tour package.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');

    const limit = await checkRateLimit(
      `agent:travel-pkg-create:${ctx.userId}`,
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

    // Validation
    if (
      !body.name ||
      typeof body.name !== 'string' ||
      body.name.trim().length === 0
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'Package name is required'
      );
    }
    if (
      !body.destination ||
      typeof body.destination !== 'string' ||
      body.destination.trim().length === 0
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'Destination is required'
      );
    }
    if (
      !body.duration_days ||
      typeof body.duration_days !== 'number' ||
      body.duration_days < 1
    ) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        'Duration (days) must be at least 1'
      );
    }
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
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        correlationId,
        `Status must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }
    if (body.price_basis && !VALID_PRICE_BASIS.includes(body.price_basis)) {
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

    const input: CreateTourPackageInput = {
      name: body.name,
      destination: body.destination,
      duration_days: body.duration_days,
      duration_nights: body.duration_nights ?? null,
      package_code: body.package_code ?? null,
      summary: body.summary ?? null,
      base_price: body.base_price ?? null,
      currency: body.currency || 'INR',
      price_basis: body.price_basis || null,
      hotel_details: body.hotel_details || null,
      transport_details: body.transport_details || null,
      inclusions: body.inclusions || [],
      exclusions: body.exclusions || [],
      terms_and_conditions: body.terms_and_conditions ?? null,
      booking_deadline: body.booking_deadline ?? null,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      status: body.status || 'draft',
      metadata: body.metadata || {},
      itinerary: body.itinerary || undefined,
      departures: body.departures || undefined,
    };

    const pkg = await createPackage(ctx.accountId, ctx.userId, input);

    return NextResponse.json(
      { success: true, data: pkg, requestId: correlationId },
      {
        status: 201,
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
    console.error('[travel/packages] POST error:', err);
    return errorResponse(500, 'INTERNAL_SERVER_ERROR', correlationId);
  }
}
