import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/auth/account';
import { requireHealthWorkplace } from '@/lib/auth/industry';
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
    const context = await requireHealthWorkplace('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name.trim();
    if (body.department !== undefined)
      updatePayload.department = body.department.trim();
    if (body.specialization !== undefined)
      updatePayload.specialization = body.specialization
        ? body.specialization.trim()
        : null;
    if (body.consultation_fee !== undefined) {
      updatePayload.consultation_fee =
        typeof body.consultation_fee === 'number'
          ? body.consultation_fee
          : parseFloat(body.consultation_fee) || 0;
    }
    if (body.working_hours !== undefined)
      updatePayload.working_hours = body.working_hours;
    if (body.available_days !== undefined)
      updatePayload.available_days = body.available_days;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.branch_id !== undefined)
      updatePayload.branch_id = body.branch_id || null;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('hospital_doctors')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select()
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
    const context = await requireHealthWorkplace('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('hospital_doctors')
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
