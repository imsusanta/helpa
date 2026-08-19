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
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const limit = Number(request.nextUrl.searchParams.get('limit')) || 50;

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[audit_logs] Fetch failed:', error);
      return errorResponse(500, error.message, correlationId);
    }

    return NextResponse.json(
      { data: logs || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'AUDIT_LOGS_FETCH_FAILED', correlationId);
  }
}
