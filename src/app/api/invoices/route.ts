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
      .select('*', { count: 'exact' })
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
      console.error('[invoices] GET base query error:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'INVOICES_FETCH_FAILED',
        correlationId,
        'Unable to load invoices.'
      );
    }

    const baseInvoices = invoices || [];
    const invoiceIds = baseInvoices
      .map((invoice) => invoice.id as string)
      .filter(Boolean);
    const contactIds = Array.from(
      new Set(
        baseInvoices
          .map((invoice) => invoice.contact_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    );

    const [itemsResult, paymentsResult, contactsResult] = await Promise.all([
      invoiceIds.length
        ? supabase
            .from('invoice_items')
            .select('*')
            .eq('account_id', ctx.accountId)
            .in('invoice_id', invoiceIds)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      invoiceIds.length
        ? supabase
            .from('invoice_payments')
            .select('*')
            .eq('account_id', ctx.accountId)
            .in('invoice_id', invoiceIds)
            .order('payment_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      contactIds.length
        ? supabase
            .from('contacts')
            .select('id, name, phone, email')
            .eq('account_id', ctx.accountId)
            .in('id', contactIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemsResult.error || paymentsResult.error || contactsResult.error) {
      console.error('[invoices] GET related data error:', {
        requestId: correlationId,
        itemsCode: itemsResult.error?.code,
        itemsMessage: itemsResult.error?.message,
        paymentsCode: paymentsResult.error?.code,
        paymentsMessage: paymentsResult.error?.message,
        contactsCode: contactsResult.error?.code,
        contactsMessage: contactsResult.error?.message,
      });
      return errorResponse(
        500,
        'INVOICES_FETCH_FAILED',
        correlationId,
        'Unable to load invoices.'
      );
    }

    const itemsByInvoice = new Map<string, unknown[]>();
    (itemsResult.data || []).forEach((item) => {
      const key = String(item.invoice_id);
      const bucket = itemsByInvoice.get(key) || [];
      bucket.push(item);
      itemsByInvoice.set(key, bucket);
    });

    const paymentsByInvoice = new Map<string, unknown[]>();
    (paymentsResult.data || []).forEach((payment) => {
      const key = String(payment.invoice_id);
      const bucket = paymentsByInvoice.get(key) || [];
      bucket.push(payment);
      paymentsByInvoice.set(key, bucket);
    });

    const contactById = new Map(
      (contactsResult.data || []).map((contact) => [
        String(contact.id),
        contact,
      ])
    );

    const hydratedInvoices = baseInvoices.map((invoice) => ({
      ...invoice,
      contacts: invoice.contact_id
        ? contactById.get(String(invoice.contact_id)) || null
        : null,
      invoice_items: itemsByInvoice.get(String(invoice.id)) || [],
      invoice_payments: paymentsByInvoice.get(String(invoice.id)) || [],
    }));

    return NextResponse.json(
      {
        success: true,
        data: hydratedInvoices,
        total: count ?? hydratedInvoices.length,
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
    console.error('[invoices] GET unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'INVOICES_FETCH_FAILED',
      correlationId,
      'Unable to load invoices.'
    );
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

    const { data: seqNumber, error: sequenceError } = await supabase.rpc(
      'generate_next_invoice_number',
      {
        p_account_id: ctx.accountId,
      }
    );

    if (sequenceError) {
      console.error('[invoices] invoice number generation error:', {
        requestId: correlationId,
        code: sequenceError.code,
        message: sequenceError.message,
      });
      return errorResponse(
        503,
        'SALES_SCHEMA_NOT_READY',
        correlationId,
        'Invoice numbering is not available.'
      );
    }

    const invoice_number =
      seqNumber ||
      `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    let subtotal = 0;
    const computedItems = items.map(
      (
        item: { description: string; quantity: number; unit_price: number },
        idx: number
      ) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unit_price = Math.max(0, Number(item.unit_price) || 0);
        const line_total = quantity * unit_price;
        subtotal += line_total;
        return {
          account_id: ctx.accountId,
          description: String(item.description || `Item ${idx + 1}`).trim(),
          quantity,
          unit_price,
          discount: 0,
          tax_rate: 0,
          line_total,
          position: idx,
        };
      }
    );

    const taxAmount = (subtotal * (Number(tax_rate) || 0)) / 100;
    const discountTotal = Math.max(0, Number(discount_amount) || 0);
    const totalAmount = Math.max(0, subtotal + taxAmount - discountTotal);

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);

    const { data: newInvoice, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        contact_id,
        deal_id: deal_id || null,
        invoice_number,
        status: 'draft',
        issue_date: issue_date || new Date().toISOString().split('T')[0],
        due_date: due_date || defaultDueDate.toISOString().split('T')[0],
        subtotal,
        discount_total: discountTotal,
        tax_total: taxAmount,
        total: totalAmount,
        amount_paid: 0,
        balance_due: totalAmount,
        currency,
        notes: notes || null,
        terms: terms || null,
      })
      .select('*')
      .single();

    if (insertErr || !newInvoice) {
      console.error('[invoices] POST insert error:', {
        requestId: correlationId,
        code: insertErr?.code,
        message: insertErr?.message,
      });
      return errorResponse(
        500,
        'INVOICE_CREATE_FAILED',
        correlationId,
        'Unable to create invoice.'
      );
    }

    const itemsPayload = computedItems.map((ci) => ({
      ...ci,
      invoice_id: newInvoice.id,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('invoice_items')
      .insert(itemsPayload)
      .select('*');

    if (itemsErr) {
      await supabase
        .from('invoices')
        .delete()
        .eq('id', newInvoice.id)
        .eq('account_id', ctx.accountId);
      console.error('[invoices] POST items insert error:', {
        requestId: correlationId,
        code: itemsErr.code,
        message: itemsErr.message,
      });
      return errorResponse(
        500,
        'INVOICE_CREATE_FAILED',
        correlationId,
        'Unable to create invoice.'
      );
    }

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
    console.error('[invoices] POST unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'INVOICE_CREATE_FAILED',
      correlationId,
      'Unable to create invoice.'
    );
  }
}
