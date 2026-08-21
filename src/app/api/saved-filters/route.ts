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

    const entityType =
      request.nextUrl.searchParams.get('entity_type') || 'contacts';

    const { data: filters, error } = await supabase
      .from('saved_filters')
      .select('*')
      .eq('account_id', context.accountId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[saved-filters GET] Error:', error);
      return NextResponse.json(
        { error: 'FETCH_SAVED_FILTERS_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: filters || [], requestId: correlationId },
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    const body = await request.json();
    const { name, entity_type, filters, is_shared } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'FILTER_NAME_REQUIRED' },
        { status: 400 }
      );
    }

    const { data: created, error } = await supabase
      .from('saved_filters')
      .insert({
        account_id: context.accountId,
        user_id: context.userId,
        entity_type: entity_type || 'contacts',
        name: name.trim(),
        filters: filters || {},
        is_shared: is_shared ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('[saved-filters POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { data: created, requestId: correlationId },
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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'FILTER_ID_REQUIRED' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('saved_filters')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, requestId: correlationId },
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
