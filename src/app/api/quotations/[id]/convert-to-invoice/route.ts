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

    // 1. Try atomic PostgreSQL RPC conversion first
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'convert_quotation_to_invoice',
      {
        p_account_id: ctx.accountId,
        p_quotation_id: quotationId,
        p_user_id: ctx.userId,
      }
    );

    if (
      !rpcError &&
      rpcResult &&
      (rpcResult as { invoice_id?: string }).invoice_id
    ) {
      const invoiceId = (rpcResult as { invoice_id: string }).invoice_id;
      const { data: newInvoice } = await supabase
        .from('invoices')
        .select('*, contacts(id, name, phone, email), invoice_items(*)')
        .eq('id', invoiceId)
        .eq('account_id', ctx.accountId)
        .single();

      try {
        await dispatchCrmEvent({
          accountId: ctx.accountId,
          eventType: 'deal.updated',
          payload: {
            quotationId,
            invoiceId,
            invoiceNumber: (rpcResult as { invoice_number?: string })
              .invoice_number,
          },
        });
      } catch {
        // ignore
      }

      return NextResponse.json(
        {
          success: true,
          data: newInvoice,
          message: `Quotation converted to Invoice ${(rpcResult as { invoice_number?: string }).invoice_number}`,
          requestId: correlationId,
        },
        {
          status: 201,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('ALREADY_CONVERTED')) {
        return errorResponse(
          409,
          'ALREADY_CONVERTED',
          correlationId,
          'Quotation is already converted.'
        );
      }
      if (msg.includes('QUOTATION_NOT_FOUND')) {
        return errorResponse(404, 'QUOTATION_NOT_FOUND', correlationId);
      }
      if (msg.includes('INSUFFICIENT_PERMISSIONS')) {
        return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
      }
    }

    // 2. Resilient Fallback (in case RPC is still migrating in dev environment)
    const { data: quotation, error: qErr } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (qErr || !quotation) {
      return errorResponse(404, 'QUOTATION_NOT_FOUND', correlationId);
    }

    if (quotation.status === 'converted') {
      return errorResponse(
        409,
        'ALREADY_CONVERTED',
        correlationId,
        'Quotation is already converted.'
      );
    }

    const { data: seqNumber } = await supabase.rpc(
      'generate_next_invoice_number',
      {
        p_account_id: ctx.accountId,
      }
    );

    const invoice_number =
      seqNumber ||
      `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { data: newInvoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        contact_id: quotation.contact_id,
        deal_id: quotation.deal_id || null,
        quotation_id: quotation.id,
        invoice_number,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: quotation.subtotal,
        tax_total: quotation.tax_total ?? quotation.tax_amount ?? 0,
        discount_total:
          quotation.discount_total ?? quotation.discount_amount ?? 0,
        total: quotation.total,
        amount_paid: 0,
        balance_due: quotation.total,
        currency: quotation.currency,
        notes:
          quotation.notes ||
          `Converted from Quotation ${quotation.quotation_number}`,
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

    const items = (quotation.quotation_items || []).map(
      (
        item: {
          description: string;
          quantity: number;
          unit_price: number;
          discount?: number;
          tax_rate?: number;
          line_total?: number;
          position?: number;
        },
        idx: number
      ) => ({
        account_id: ctx.accountId,
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount ?? 0,
        tax_rate: item.tax_rate ?? 0,
        line_total: item.line_total ?? item.quantity * item.unit_price,
        position: item.position ?? idx,
      })
    );

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(items);
    }

    await supabase
      .from('quotations')
      .update({ status: 'converted', updated_at: new Date().toISOString() })
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
