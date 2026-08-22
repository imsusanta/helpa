import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { dispatchCrmEvent } from '@/core/events';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: quotationId } = await params;
    if (!quotationId) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();

    // 1. Fetch quotation with items
    const { data: quotation, error: qErr } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (qErr || !quotation) {
      return errorResponse(404, 'QUOTATION_NOT_FOUND', correlationId);
    }

    // 2. Generate unique Invoice Number
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId);

    const year = new Date().getFullYear();
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    const invoice_number = `INV-${year}-${seq}`;

    // Due date defaults to 14 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    // 3. Create Invoice
    const { data: newInvoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        contact_id: quotation.contact_id,
        deal_id: quotation.deal_id || null,
        invoice_number,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: quotation.subtotal,
        tax_amount: quotation.tax_amount,
        discount_amount: quotation.discount_amount,
        total: quotation.total,
        amount_paid: 0,
        currency: quotation.currency,
        notes:
          quotation.notes ||
          `Created from Quotation ${quotation.quotation_number}`,
        terms: quotation.terms,
      })
      .select('*, contacts(id, name, phone, email)')
      .single();

    if (invErr || !newInvoice) {
      return errorResponse(
        500,
        'INVOICE_CREATE_FAILED',
        correlationId,
        invErr?.message
      );
    }

    // 4. Create Invoice Items from Quotation Items
    const items = (quotation.quotation_items || []).map(
      (
        item: {
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          order_index?: number;
        },
        idx: number
      ) => ({
        account_id: ctx.accountId,
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        order_index: item.order_index ?? idx,
      })
    );

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(items);
    }

    // 5. Update quotation status to accepted
    await supabase
      .from('quotations')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', quotationId)
      .eq('account_id', ctx.accountId);

    try {
      await dispatchCrmEvent({
        accountId: ctx.accountId,
        eventType: 'deal.updated',
        payload: {
          quotationId,
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.invoice_number,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        success: true,
        data: newInvoice,
        message: `Quotation converted to Invoice ${invoice_number}`,
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
    return errorResponse(500, 'CONVERT_TO_INVOICE_FAILED', correlationId);
  }
}
