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

    const contactId = searchParams.get('contact_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let query = supabase
      .from('invoices')
      .select(
        '*, contacts(id, name, phone, email), invoice_items(*), invoice_payments(*)',
        { count: 'exact' }
      )
      .eq('account_id', ctx.accountId);

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`invoice_number.ilike.%${term}%,notes.ilike.%${term}%`);
    }

    const {
      data: invoices,
      count,
      error,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(
        500,
        'INVOICES_FETCH_FAILED',
        correlationId,
        error.message
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: invoices || [],
        total: count ?? (invoices || []).length,
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
    return errorResponse(500, 'INVOICES_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      contact_id,
      deal_id,
      issue_date,
      due_date,
      currency = 'INR',
      tax_rate = 0,
      discount_amount = 0,
      notes,
      terms,
      items = [],
    } = body;

    if (!contact_id) {
      return errorResponse(
        400,
        'CONTACT_REQUIRED',
        correlationId,
        'Contact is required for invoice.'
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(
        400,
        'ITEMS_REQUIRED',
        correlationId,
        'At least one line item is required.'
      );
    }

    // Generate unique Invoice Number via concurrency-safe atomic sequence
    const { data: seqNumber } = await supabase.rpc(
      'generate_next_invoice_number',
      {
        p_account_id: ctx.accountId,
      }
    );

    const invoice_number =
      seqNumber ||
      `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Calculate totals
    let subtotal = 0;
    const computedItems = items.map(
      (
        item: { description: string; quantity: number; unit_price: number },
        idx: number
      ) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unit_price = Math.max(0, Number(item.unit_price) || 0);
        const total = quantity * unit_price;
        subtotal += total;
        return {
          account_id: ctx.accountId,
          description: String(item.description || `Item ${idx + 1}`).trim(),
          quantity,
          unit_price,
          total,
          order_index: idx,
        };
      }
    );

    const taxAmount = (subtotal * (Number(tax_rate) || 0)) / 100;
    const totalAmount = Math.max(
      0,
      subtotal + taxAmount - (Number(discount_amount) || 0)
    );

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);

    // Insert Invoice
    const { data: newInvoice, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        contact_id,
        deal_id: deal_id || null,
        invoice_number,
        status: 'draft',
        issue_date: issue_date || new Date().toISOString().split('T')[0],
        due_date: due_date || defaultDueDate.toISOString().split('T')[0],
        subtotal,
        tax_amount: taxAmount,
        discount_amount: Number(discount_amount) || 0,
        total: totalAmount,
        amount_paid: 0,
        currency,
        notes: notes || null,
        terms: terms || null,
      })
      .select('*, contacts(id, name, phone, email)')
      .single();

    if (insertErr || !newInvoice) {
      return errorResponse(
        500,
        'INVOICE_CREATE_FAILED',
        correlationId,
        insertErr?.message
      );
    }

    // Insert line items
    const itemsPayload = computedItems.map((ci) => ({
      ...ci,
      invoice_id: newInvoice.id,
    }));

    const { data: insertedItems } = await supabase
      .from('invoice_items')
      .insert(itemsPayload)
      .select();

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newInvoice,
          invoice_items: insertedItems || [],
          invoice_payments: [],
        },
        requestId: correlationId,
      },
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
    return errorResponse(500, 'INVOICE_CREATE_FAILED', correlationId);
  }
}
