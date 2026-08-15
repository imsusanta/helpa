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
    if (body.test_name !== undefined)
      updatePayload.test_name = body.test_name.trim();
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.department !== undefined)
      updatePayload.department = body.department || null;
    if (body.doctor_id !== undefined)
      updatePayload.doctor_id = body.doctor_id || null;
    if (body.expected_delivery_date !== undefined)
      updatePayload.expected_delivery_date =
        body.expected_delivery_date || null;
    if (body.report_pdf_url !== undefined)
      updatePayload.report_pdf_url = body.report_pdf_url || null;
    if (body.result_url !== undefined)
      updatePayload.result_url = body.result_url || null;
    if (body.notes !== undefined) updatePayload.notes = body.notes || null;
    if (body.internal_notes !== undefined)
      updatePayload.internal_notes = body.internal_notes || null;
    if (body.notified_patient !== undefined)
      updatePayload.notified_patient = body.notified_patient;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('hospital_lab_reports')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, department)'
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
      .from('hospital_lab_reports')
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
