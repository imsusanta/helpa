import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};
const BILL_STATUSES = new Set(['unpaid', 'paid', 'overdue']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const status = request.nextUrl.searchParams.get('status');

    if (status && !BILL_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid bill status' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    let query = supabase
      .from('hospital_bills')
      .select('*, patient:contacts(id, name, phone)')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: 'Failed to load billing records' },
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
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    const patientId =
      typeof body?.patient_id === 'string' ? body.patient_id.trim() : '';
    const description =
      typeof body?.description === 'string'
        ? body.description.trim()
        : 'Medical Services';
    const amount =
      typeof body?.amount === 'number'
        ? body.amount
        : typeof body?.amount === 'string'
          ? Number(body.amount)
          : Number.NaN;
    const status =
      typeof body?.status === 'string' ? body.status.trim() : 'unpaid';

    if (!UUID_PATTERN.test(patientId)) {
      return NextResponse.json(
        { error: 'A valid patient is required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }
    if (!description || description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be between 1 and 500 characters' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }
    if (!BILL_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid bill status' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data: patient, error: patientError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', patientId)
      .eq('account_id', context.accountId)
      .maybeSingle();

    if (patientError) {
      return NextResponse.json(
        { error: 'Failed to validate patient' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const billNumber = `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { data, error } = await supabase
      .from('hospital_bills')
      .insert({
        account_id: context.accountId,
        patient_id: patientId,
        bill_number: billNumber,
        description,
        amount,
        status,
      })
      .select('*, patient:contacts(id, name, phone)')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create billing record' },
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
