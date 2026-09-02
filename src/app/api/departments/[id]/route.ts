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
    if (body.description !== undefined)
      updatePayload.description = body.description
        ? body.description.trim()
        : null;
    if (body.head_doctor_id !== undefined)
      updatePayload.head_doctor_id = body.head_doctor_id || null;
    if (body.floor_location !== undefined)
      updatePayload.floor_location = body.floor_location
        ? body.floor_location.trim()
        : null;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('hospital_departments')
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
      .from('hospital_departments')
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
