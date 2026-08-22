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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: invoiceId } = await params;
    if (!invoiceId) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: payments, error } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('account_id', ctx.accountId)
      .order('payment_date', { ascending: false });

    if (error) {
      return errorResponse(
        500,
        'PAYMENTS_FETCH_FAILED',
        correlationId,
        error.message
      );
    }

    return NextResponse.json(
      { success: true, data: payments || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PAYMENTS_FETCH_FAILED', correlationId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: invoiceId } = await params;
    if (!invoiceId) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      amount,
      payment_method = 'upi',
      transaction_reference,
      notes,
      payment_date,
    } = body;

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return errorResponse(
        400,
        'INVALID_AMOUNT',
        correlationId,
        'Payment amount must be greater than 0.'
      );
    }

    // 1. Fetch current invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (invErr || !invoice) {
      return errorResponse(404, 'INVOICE_NOT_FOUND', correlationId);
    }

    // 2. Insert payment
    const { data: newPayment, error: payErr } = await supabase
      .from('invoice_payments')
      .insert({
        account_id: ctx.accountId,
        invoice_id: invoiceId,
        amount: paymentAmount,
        currency: invoice.currency,
        payment_method: String(payment_method),
        transaction_reference: transaction_reference || null,
        notes: notes || null,
        payment_date: payment_date
          ? new Date(payment_date).toISOString()
          : new Date().toISOString(),
      })
      .select()
      .single();

    if (payErr || !newPayment) {
      return errorResponse(
        500,
        'PAYMENT_RECORD_FAILED',
        correlationId,
        payErr?.message
      );
    }

    // 3. Recalculate total paid
    const newAmountPaid = (Number(invoice.amount_paid) || 0) + paymentAmount;
    let newStatus = invoice.status;
    if (newAmountPaid >= Number(invoice.total)) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid';
    }

    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('account_id', ctx.accountId)
      .select(
        '*, contacts(id, name, phone, email), invoice_items(*), invoice_payments(*)'
      )
      .single();

    // 4. Dispatch CRM Event
    try {
      await dispatchCrmEvent({
        accountId: ctx.accountId,
        eventType: 'deal.updated',
        payload: {
          invoiceId,
          paymentId: newPayment.id,
          amount: paymentAmount,
          newStatus,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedInvoice,
        payment: newPayment,
        message: `Payment of ${invoice.currency} ${paymentAmount} recorded successfully.`,
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
    return errorResponse(500, 'PAYMENT_RECORD_FAILED', correlationId);
  }
}
