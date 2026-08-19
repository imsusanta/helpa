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

function errorResponse(
  status: number,
  code: string,
  correlationId: string
): NextResponse {
  return NextResponse.json(
    { error: code, requestId: correlationId },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: fields, error } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[custom-fields] Fetch failed:', error);
      return errorResponse(500, error.message, correlationId);
    }

    return NextResponse.json(
      { data: fields || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CUSTOM_FIELDS_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, key, field_type, options, required } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse(400, 'NAME_REQUIRED', correlationId);
    }

    const fieldKey = (key || name).toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const { data: newField, error: insertErr } = await supabase
      .from('custom_fields')
      .insert({
        account_id: context.accountId,
        name: name.trim(),
        key: fieldKey,
        field_type: field_type || 'text',
        options: Array.isArray(options) ? options : [],
        required: Boolean(required),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[custom-fields] Insert failed:', insertErr);
      return errorResponse(500, insertErr.message, correlationId);
    }

    return NextResponse.json(
      { data: newField, requestId: correlationId },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CUSTOM_FIELD_CREATE_FAILED', correlationId);
  }
}
