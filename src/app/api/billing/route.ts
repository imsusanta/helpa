import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('hospital_bills')
      .select('*, patient:contacts(id, name, phone)')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data: data || [] },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { patient_id, description, amount, status } = body;

    if (!patient_id || amount === undefined) {
      return NextResponse.json(
        { error: 'Patient and Amount are required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const billNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const { data, error } = await supabase
      .from('hospital_bills')
      .insert({
        account_id: context.accountId,
        patient_id,
        bill_number: billNumber,
        description: (description || 'Medical Services').trim(),
        amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0.0,
        status: status || 'unpaid',
      })
      .select('*, patient:contacts(id, name, phone)')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
