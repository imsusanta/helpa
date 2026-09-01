import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { requireTravelWorkplace } from '@/lib/travel/access';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  presentQuotation,
  QUOTATION_ITEMS_FK,
} from '@/lib/sales/quotation-presenter';

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
    const ctx = await requireTravelWorkplace('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;
    const contactId = searchParams.get('contact_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // quotation_items has both a simple FK and a composite tenant FK to quotations.
    // Explicitly select the simple FK relationship to avoid PostgREST PGRST201/HTTP 300
    // ambiguous-relationship errors.
    let query = supabase
      .from('quotations')
      .select(`*, contacts(id, name, phone, email), ${QUOTATION_ITEMS_FK}(*)`, {
        count: 'exact',
      })
      .eq('account_id', ctx.accountId);

    if (contactId) query = query.eq('contact_id', contactId);
    if (status && status !== 'all') query = query.eq('status', status);
    if (search?.trim()) {
      const term = search
        .trim()
        .replace(/[%_(),]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (term) {
        query = query.or(
          `quotation_number.ilike.%${term}%,notes.ilike.%${term}%,travel_details->>destination.ilike.%${term}%,travel_details->>proposal_title.ilike.%${term}%`
        );
      }
    }

    const {
      data: quotations,
      count,
      error,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[quotations] GET query failed:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return errorResponse(
        500,
        'QUOTATIONS_FETCH_FAILED',
        correlationId,
        'Unable to load quotations.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: (quotations || []).map(presentQuotation),
        total: count ?? (quotations || []).length,
        limit,
        offset,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError)
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    if (err instanceof ForbiddenError)
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    console.error('[quotations] GET unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'QUOTATIONS_FETCH_FAILED',
      correlationId,
      'Unable to load quotations.'
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireTravelWorkplace('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();
    const {
      contact_id,
      deal_id,
      valid_until,
      currency = 'INR',
      tax_rate = 0,
      discount_amount = 0,
      notes,
      terms,
      items = [],
      travel_details,
    } = body;

    if (!contact_id)
      return errorResponse(
        400,
        'CONTACT_REQUIRED',
        correlationId,
        'Contact is required for quotation.'
      );
    if (!Array.isArray(items) || items.length === 0)
      return errorResponse(
        400,
        'ITEMS_REQUIRED',
        correlationId,
        'At least one line item is required.'
      );

    const { data: seqNumber, error: sequenceError } = await supabase.rpc(
      'generate_next_quotation_number',
      { p_account_id: ctx.accountId }
    );
    if (sequenceError)
      return errorResponse(
        500,
        'QUOTATION_NUMBER_FAILED',
        correlationId,
        'Unable to generate quotation number.'
      );

    const quotation_number =
      seqNumber ||
      `QT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    let subtotal = 0;
    const computedItems = items.map(
      (
        item: {
          description: string;
          quantity: number;
          unit_price: number;
          category?: string;
        },
        idx: number
      ) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unit_price = Math.max(0, Number(item.unit_price) || 0);
        const total = quantity * unit_price;
        const description = String(
          item.description || `Item ${idx + 1}`
        ).trim();
        const category = String(item.category || '').trim();
        subtotal += total;
        return {
          account_id: ctx.accountId,
          quotation_id: '',
          description:
            category && category !== 'Other'
              ? `${category}: ${description}`
              : description,
          quantity,
          unit_price,
          discount: 0,
          tax_rate: 0,
          line_total: total,
          position: idx,
        };
      }
    );

    const taxAmount = (subtotal * (Number(tax_rate) || 0)) / 100;
    const discountTotal = Math.max(0, Number(discount_amount) || 0);
    const totalAmount = Math.max(0, subtotal + taxAmount - discountTotal);
    const normalizedTravelDetails =
      travel_details && typeof travel_details === 'object'
        ? travel_details
        : null;
    const publicToken = normalizedTravelDetails ? crypto.randomUUID() : null;

    const { data: newQuotation, error: insertErr } = await supabase
      .from('quotations')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        contact_id,
        deal_id: deal_id || null,
        quotation_number,
        status: 'draft',
        valid_until: valid_until || null,
        subtotal,
        tax_total: taxAmount,
        discount_total: discountTotal,
        total: totalAmount,
        currency,
        notes: notes || null,
        terms: terms || null,
        travel_details: normalizedTravelDetails,
        public_token: publicToken,
      })
      .select('*, contacts(id, name, phone, email)')
      .single();

    if (insertErr || !newQuotation) {
      console.error('[quotations] POST insert failed:', {
        requestId: correlationId,
        code: insertErr?.code,
        message: insertErr?.message,
        details: insertErr?.details,
      });
      return errorResponse(
        500,
        'QUOTATION_CREATE_FAILED',
        correlationId,
        'Unable to create quotation.'
      );
    }

    const itemsPayload = computedItems.map((item) => ({
      ...item,
      quotation_id: newQuotation.id,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from('quotation_items')
      .insert(itemsPayload)
      .select();
    if (itemsError) {
      console.error('[quotations] item insert failed:', {
        requestId: correlationId,
        code: itemsError.code,
        message: itemsError.message,
        details: itemsError.details,
      });
      await supabase
        .from('quotations')
        .delete()
        .eq('id', newQuotation.id)
        .eq('account_id', ctx.accountId);
      return errorResponse(
        500,
        'QUOTATION_ITEMS_CREATE_FAILED',
        correlationId,
        'Unable to create quotation items.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: presentQuotation({
          ...newQuotation,
          quotation_items: insertedItems || [],
        }),
        requestId: correlationId,
      },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError)
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    if (err instanceof ForbiddenError)
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    console.error('[quotations] POST unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'QUOTATION_CREATE_FAILED',
      correlationId,
      'Unable to create quotation.'
    );
  }
}
