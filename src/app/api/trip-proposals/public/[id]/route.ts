import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
};

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trip-proposals/public/[id]
 * Public endpoint to fetch trip proposal data for shareable proposal view.
 */
export async function GET(
  _request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { data: proposal, error } = await supabase
      .from('trip_proposals')
      .select('id, proposal_number, title, destination, duration_days, duration_nights, start_date, end_date, adults_count, children_count, currency, base_price, tax_amount, discount_amount, total_price, inclusions, exclusions, itinerary, hotel_details, transport_details, notes, terms, status, valid_until, sent_at, created_at, contacts(id, name, phone), accounts(name, industry), travel_packages(id, name, destination, duration_days, price, description)')
      .eq('id', id)
      .maybeSingle();

    if (error || !proposal) {
      return NextResponse.json(
        { success: false, error: 'PROPOSAL_NOT_FOUND', message: 'Trip proposal not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: proposal },
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (err) {
    console.error('[trip-proposals/public] Error:', err);
    return NextResponse.json(
      { success: false, error: 'SERVER_ERROR', message: 'Failed to fetch proposal.' },
      { status: 500 }
    );
  }
}
