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
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error('INVALID_PAGINATION');
  return Number(value);
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

/**
 * Tenant-scoped contact list boundary. Account identity is resolved only from
 * authenticated session; query parameters never select a tenant.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const limit = parsePositiveInteger(
      request.nextUrl.searchParams.get('limit'),
      DEFAULT_LIMIT
    );
    const offset = parsePositiveInteger(
      request.nextUrl.searchParams.get('offset'),
      0
    );
    if (limit < 1 || limit > MAX_LIMIT || offset < 0) {
      return errorResponse(400, 'INVALID_PAGINATION', correlationId);
    }
    const search = request.nextUrl.searchParams.get('search')?.trim();
    if (search && search.length > 100) {
      return errorResponse(400, 'INVALID_SEARCH', correlationId);
    }

    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('account_id', context.accountId);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const {
      data: contacts,
      count,
      error,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[contacts] Supabase query failed:', error);
      return errorResponse(502, 'CONTACTS_QUERY_FAILED', correlationId);
    }

    const rows = contacts || [];
    return NextResponse.json(
      {
        data: rows.map((contact) => ({
          id: contact.id,
          account_id: contact.account_id,
          user_id: contact.user_id ?? '',
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          address: contact.address,
          metadata: contact.metadata,
          consentStatus: contact.consent_status || 'pending',
          created_at: contact.created_at,
          updated_at: contact.updated_at,
        })),
        total: count ?? rows.length,
        limit,
        offset,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error(
      JSON.stringify({
        event: 'contacts_query_failed',
        requestId: correlationId,
      })
    );
    return errorResponse(502, 'CONTACTS_QUERY_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, phone, email, address, metadata } = body;

    if (!name || !phone) {
      return errorResponse(400, 'NAME_AND_PHONE_REQUIRED', correlationId);
    }

    const { data: newContact, error: insertErr } = await supabase
      .from('contacts')
      .insert({
        account_id: context.accountId,
        user_id: context.userId,
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[contacts] Insert failed:', insertErr);
      return errorResponse(500, insertErr.message, correlationId);
    }

    return NextResponse.json(
      { data: newContact, requestId: correlationId },
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
    return errorResponse(500, 'CONTACT_CREATE_FAILED', correlationId);
  }
}
