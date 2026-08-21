import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    // Fetch recent notifications for account & user
    const { data: notifications, error } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('account_id', context.accountId)
      .or(`user_id.eq.${context.userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.warn(
        '[notifications GET] Query warning/missing table:',
        error.message
      );
      return NextResponse.json(
        { data: [], unreadCount: 0, requestId: correlationId },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    const unreadCount = (notifications || []).filter((n) => !n.is_read).length;

    return NextResponse.json(
      {
        data: notifications || [],
        unreadCount,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ACCOUNT_MEMBERSHIP_REQUIRED' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const body = await request.json();
    const { id, markAllRead } = body;

    if (markAllRead) {
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true })
        .eq('account_id', context.accountId)
        .or(`user_id.eq.${context.userId},user_id.is.null`);

      return NextResponse.json(
        { success: true, requestId: correlationId },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    if (id) {
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('account_id', context.accountId);

      return NextResponse.json(
        { success: true, requestId: correlationId },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    const body = await request.json();
    const { title, body: notifBody, type, link_url, user_id, metadata } = body;

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: 'TITLE_AND_BODY_REQUIRED' },
        { status: 400 }
      );
    }

    const { data: created, error } = await supabase
      .from('in_app_notifications')
      .insert({
        account_id: context.accountId,
        user_id: user_id || null,
        title,
        body: notifBody,
        type: type || 'general',
        link_url: link_url || null,
        metadata: metadata || {},
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { data: created, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
