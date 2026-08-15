import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.description !== undefined)
      updatePayload.description = body.description.trim();
    if (body.amount !== undefined) {
      updatePayload.amount =
        typeof body.amount === 'number'
          ? body.amount
          : parseFloat(body.amount) || 0.0;
    }

    const { data, error } = await supabase
      .from('hospital_bills')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select('*, patient:contacts(id, name, phone)')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
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

    const { error } = await supabase
      .from('hospital_bills')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}
