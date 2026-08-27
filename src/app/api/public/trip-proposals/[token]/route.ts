import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import {
  presentQuotation,
  QUOTATION_ITEMS_FK,
} from '@/lib/sales/quotation-presenter';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function hasTravelDetails(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return NextResponse.json(
      { error: 'Invalid proposal link' },
      { status: 400, headers: PRIVATE_HEADERS }
    );
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('quotations')
    .select(
      `quotation_number,status,valid_until,subtotal,tax_total,discount_total,total,currency,notes,terms,created_at,public_token,travel_details,contacts(name,phone,email),${QUOTATION_ITEMS_FK}(description,quantity,unit_price,line_total)`
    )
    .eq('public_token', token)
    .maybeSingle();

  if (error) {
    console.error('[public-trip-proposal] fetch failed:', error);
    return NextResponse.json(
      { error: 'Unable to load proposal' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
  if (!data || !hasTravelDetails(data.travel_details)) {
    return NextResponse.json(
      { error: 'Proposal not found' },
      { status: 404, headers: PRIVATE_HEADERS }
    );
  }
  if (data.status === 'rejected' || data.status === 'expired') {
    return NextResponse.json(
      { error: 'This proposal is no longer available' },
      { status: 410, headers: PRIVATE_HEADERS }
    );
  }

  const presented = presentQuotation({
    ...data,
    quotation_items: data.quotation_items ?? [],
  }) as Record<string, unknown>;

  return NextResponse.json(
    {
      success: true,
      data: {
        quotation_number: presented.quotation_number,
        status: presented.status,
        valid_until: presented.valid_until,
        subtotal: presented.subtotal,
        tax_amount: presented.tax_amount,
        discount_amount: presented.discount_amount,
        total: presented.total,
        currency: presented.currency,
        notes: presented.notes,
        terms: presented.terms,
        created_at: presented.created_at,
        contacts: presented.contacts,
        quotation_items: presented.quotation_items,
        travel_details: presented.travel_details,
      },
    },
    { headers: PRIVATE_HEADERS }
  );
}
