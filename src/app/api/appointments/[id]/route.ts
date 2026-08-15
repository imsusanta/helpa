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
    if (body.doctor_id !== undefined)
      updatePayload.doctor_id = body.doctor_id || null;
    if (body.appointment_date !== undefined)
      updatePayload.appointment_date = body.appointment_date;
    if (body.appointment_time !== undefined)
      updatePayload.appointment_time = body.appointment_time;
    if (body.department !== undefined)
      updatePayload.department = body.department || null;
    if (body.notes !== undefined) updatePayload.notes = body.notes || null;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select(
        'id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
      )
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
      .from('appointments')
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
