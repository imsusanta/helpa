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

/**
 * GET /api/trip-proposals
 * List trip proposals for the authenticated account with optional filters.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;

    const contactId = searchParams.get('contact_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let query = supabase
      .from('trip_proposals')
      .select(
        '*, contacts(id, name, phone, email), travel_packages(id, name, destination, duration_days, price)',
        {
          count: 'exact',
        }
      )
      .eq('account_id', ctx.accountId);

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(
        `proposal_number.ilike.%${term}%,title.ilike.%${term}%,destination.ilike.%${term}%`
      );
    }

    const {
      data: proposals,
      count,
      error,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[trip-proposals] GET query failed:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'TRIP_PROPOSALS_FETCH_FAILED',
        correlationId,
        'Unable to load trip proposals.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: proposals || [],
        total: count ?? (proposals || []).length,
        limit,
        offset,
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
    console.error('[trip-proposals] Unexpected error:', error);
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'An unexpected error occurred.'
    );
  }
}

/**
 * POST /api/trip-proposals
 * Create a new trip proposal.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      contact_id,
      package_id,
      title,
      destination,
      duration_days = 3,
      duration_nights = 2,
      start_date,
      end_date,
      adults_count = 2,
      children_count = 0,
      base_price = 0,
      tax_amount = 0,
      discount_amount = 0,
      inclusions,
      exclusions,
      itinerary,
      hotel_details,
      transport_details,
      notes,
      terms,
      valid_until,
    } = body;

    if (!title || !destination) {
      return errorResponse(
        400,
        'INVALID_REQUEST',
        correlationId,
        'Title and Destination are required.'
      );
    }

    const calculatedTotal = Math.max(
      0,
      Number(base_price || 0) +
        Number(tax_amount || 0) -
        Number(discount_amount || 0)
    );

    // Generate Proposal Number (e.g. TRIP-1001, TRIP-1002...)
    const { data: latestProposal } = await supabase
      .from('trip_proposals')
      .select('proposal_number')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1001;
    if (latestProposal?.proposal_number) {
      const match = latestProposal.proposal_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const proposal_number = `TRIP-${nextNumber}`;

    const defaultInclusions = [
      'Hotel Accommodation',
      'Daily Breakfast & Dinner',
      'Private Sightseeing Cab',
      'All Toll, Parking & Driver Charges',
    ];

    const defaultExclusions = [
      'Airfare / Train Tickets',
      'Personal Expenses, Tips & Laundry',
      'Entry Fees & Activity Charges',
    ];

    const payload = {
      account_id: ctx.accountId,
      contact_id: contact_id || null,
      package_id: package_id || null,
      proposal_number,
      title: title.trim(),
      destination: destination.trim(),
      duration_days: Number(duration_days) || 1,
      duration_nights: Number(duration_nights) || 0,
      start_date: start_date || null,
      end_date: end_date || null,
      adults_count: Number(adults_count) || 1,
      children_count: Number(children_count) || 0,
      currency: 'INR',
      base_price: Number(base_price) || 0,
      tax_amount: Number(tax_amount) || 0,
      discount_amount: Number(discount_amount) || 0,
      total_price: calculatedTotal,
      inclusions:
        Array.isArray(inclusions) && inclusions.length > 0
          ? inclusions
          : defaultInclusions,
      exclusions:
        Array.isArray(exclusions) && exclusions.length > 0
          ? exclusions
          : defaultExclusions,
      itinerary: Array.isArray(itinerary) ? itinerary : [],
      hotel_details: hotel_details || null,
      transport_details: transport_details || null,
      notes: notes || null,
      terms:
        terms ||
        '50% advance for booking confirmation. Balance payment 7 days before trip start date.',
      status: 'draft',
      valid_until: valid_until || null,
      created_by: ctx.userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('trip_proposals')
      .insert(payload)
      .select('*, contacts(id, name, phone, email)')
      .single();

    if (error) {
      console.error('[trip-proposals] Creation failed:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'TRIP_PROPOSAL_CREATE_FAILED',
        correlationId,
        'Failed to create trip proposal.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: 'Trip proposal created successfully.',
      },
      { status: 201, headers: PRIVATE_HEADERS }
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
    console.error('[trip-proposals] Unexpected error:', error);
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'An unexpected error occurred.'
    );
  }
}
