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
  correlationId: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message || code,
      requestId: correlationId,
    },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;

    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let query = supabase
      .from('contacts')
      .select(
        '*, deals(id, value, status), invoices(id, total, status, amount_paid), quotations(id, total, status)',
        { count: 'exact' }
      )
      .eq('account_id', ctx.accountId);

    if (tag && tag !== 'all') {
      query = query.contains('tags', [tag]);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(
        `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
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
      return errorResponse(
        500,
        'CUSTOMERS_FETCH_FAILED',
        correlationId,
        error.message
      );
    }

    const customerRows = (contacts || []).map((c) => {
      const dealsList =
        (c.deals as Array<{ id: string; value: number; status: string }>) || [];
      const invoicesList =
        (c.invoices as Array<{
          id: string;
          total: number;
          status: string;
          amount_paid: number;
        }>) || [];
      const quotationsList =
        (c.quotations as Array<{
          id: string;
          total: number;
          status: string;
        }>) || [];

      const totalRevenue = invoicesList
        .filter(
          (inv) => inv.status === 'paid' || inv.status === 'partially_paid'
        )
        .reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0);

      const openDealsValue = dealsList
        .filter((d) => d.status === 'open')
        .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

      return {
        ...c,
        dealsCount: dealsList.length,
        invoicesCount: invoicesList.length,
        quotationsCount: quotationsList.length,
        totalRevenue,
        openDealsValue,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: customerRows,
        total: count ?? customerRows.length,
        limit,
        offset,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CUSTOMERS_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      name,
      phone,
      email,
      address,
      tags = ['Customer'],
      metadata = {},
    } = body;

    if (!name || !String(name).trim()) {
      return errorResponse(
        400,
        'NAME_REQUIRED',
        correlationId,
        'Customer name is required.'
      );
    }

    const normalizedPhone = phone
      ? String(phone).replace(/[^\d+]/g, '')
      : `+910000000000`;

    const { data: newCustomer, error: insertErr } = await supabase
      .from('contacts')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        name: String(name).trim(),
        phone: normalizedPhone,
        email: email ? String(email).trim().toLowerCase() : null,
        tags: Array.isArray(tags) ? tags : ['Customer'],
        metadata: {
          ...metadata,
          address: address ? String(address).trim() : undefined,
        },
      })
      .select()
      .single();

    if (insertErr || !newCustomer) {
      return errorResponse(
        500,
        'CUSTOMER_CREATE_FAILED',
        correlationId,
        insertErr?.message
      );
    }

    return NextResponse.json(
      { success: true, data: newCustomer, requestId: correlationId },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CUSTOMER_CREATE_FAILED', correlationId);
  }
}
