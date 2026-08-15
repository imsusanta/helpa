import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

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

    const {
      name,
      message,
      target_type,
      target_tag_id,
      scheduled_at,
      status,
      total_recipients,
    } = body;

    if (!name || !message) {
      return NextResponse.json(
        { error: 'Name and Message are required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        account_id: context.accountId,
        created_by: context.userId,
        name: name.trim(),
        message: message.trim(),
        target_type: target_type || 'all',
        target_tag_id: target_tag_id || null,
        scheduled_at: scheduled_at || null,
        status: status || 'draft',
        total_recipients: total_recipients || 0,
      })
      .select()
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
