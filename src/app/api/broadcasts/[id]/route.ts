import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();

    if (error || !broadcast) {
      return NextResponse.json(
        { error: 'Broadcast not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const { data: recipients } = await supabase
      .from('broadcast_recipients')
      .select('*, contact:contacts(id, name, phone)')
      .eq('broadcast_id', id)
      .eq('account_id', context.accountId);

    return NextResponse.json(
      { data: { ...broadcast, recipients: recipients || [] } },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

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
    if (body.name !== undefined) updatePayload.name = body.name.trim();
    if (body.message !== undefined) updatePayload.message = body.message.trim();
    if (body.target_type !== undefined)
      updatePayload.target_type = body.target_type;
    if (body.target_tag_id !== undefined)
      updatePayload.target_tag_id = body.target_tag_id || null;
    if (body.scheduled_at !== undefined)
      updatePayload.scheduled_at = body.scheduled_at || null;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.total_recipients !== undefined)
      updatePayload.total_recipients = body.total_recipients;
    if (body.sent_count !== undefined)
      updatePayload.sent_count = body.sent_count;
    if (body.delivered_count !== undefined)
      updatePayload.delivered_count = body.delivered_count;
    if (body.read_count !== undefined)
      updatePayload.read_count = body.read_count;
    if (body.failed_count !== undefined)
      updatePayload.failed_count = body.failed_count;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('broadcasts')
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
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('broadcasts')
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
