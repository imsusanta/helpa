import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid proposal link' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('quotations')
    .select('quotation_number,status,valid_until,subtotal,tax_amount,discount_amount,total,currency,notes,terms,created_at,public_token,travel_details,contacts(name,phone,email),quotation_items(description,quantity,unit_price,total)')
    .eq('public_token', token)
    .maybeSingle();

  if (error) {
    console.error('[public-trip-proposal] fetch failed:', error);
    return NextResponse.json({ error: 'Unable to load proposal' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (data.status === 'rejected' || data.status === 'expired') {
    return NextResponse.json({ error: 'This proposal is no longer available' }, { status: 410 });
  }

  return NextResponse.json({
    success: true,
    data: {
      quotation_number: data.quotation_number,
      status: data.status,
      valid_until: data.valid_until,
      subtotal: data.subtotal,
      tax_amount: data.tax_amount,
      discount_amount: data.discount_amount,
      total: data.total,
      currency: data.currency,
      notes: data.notes,
      terms: data.terms,
      created_at: data.created_at,
      contacts: data.contacts,
      quotation_items: data.quotation_items,
      travel_details: data.travel_details,
    },
  });
}
