import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};
const BILL_STATUSES = new Set(['unpaid', 'paid', 'overdue']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!UUID_PATTERN.test(id) || !body) {
      return NextResponse.json(
        { error: 'Invalid billing update' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !BILL_STATUSES.has(body.status)) {
        return NextResponse.json(
          { error: 'Invalid bill status' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.status = body.status;
    }
    if (body.description !== undefined) {
      const description =
        typeof body.description === 'string' ? body.description.trim() : '';
      if (!description || description.length > 500) {
        return NextResponse.json(
          { error: 'Description must be between 1 and 500 characters' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.description = description;
    }
    if (body.amount !== undefined) {
      const amount =
        typeof body.amount === 'number'
          ? body.amount
          : typeof body.amount === 'string'
            ? Number(body.amount)
            : Number.NaN;
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be greater than zero' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.amount = amount;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No supported fields were provided' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('hospital_bills')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select('*, patient:contacts(id, name, phone)')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update billing record' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Billing record not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: 'Invalid billing record' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('hospital_bills')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete billing record' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Billing record not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}
