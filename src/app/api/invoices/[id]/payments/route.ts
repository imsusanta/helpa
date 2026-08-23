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
      console.error('[invoice payments fetch]', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });

      return errorResponse(
        500,
        'PAYMENTS_FETCH_FAILED',
        correlationId,
        'Unable to load invoice payments.'
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
    console.error('[invoice payments fetch unhandled error]', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'PAYMENTS_FETCH_FAILED',
      correlationId,
      'Unable to load invoice payments.'
    );
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
      payment_method = 'cash',
      transaction_reference,
      notes,
    } = body;

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return errorResponse(
        400,
        'INVALID_PAYMENT_AMOUNT',
        correlationId,
        'Payment amount must be greater than 0.'
      );
    }

    // Call atomic PostgreSQL RPC execution
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'record_invoice_payment',
      {
        p_account_id: ctx.accountId,
        p_invoice_id: invoiceId,
        p_amount: paymentAmount,
        p_payment_method: String(payment_method),
        p_reference_note: transaction_reference || notes || null,
        p_user_id: ctx.userId,
      }
    );

    if (rpcError) {
      console.error('[invoice payment]', {
        requestId: correlationId,
        code: rpcError.code,
        message: rpcError.message,
      });

      const msg = rpcError.message || '';

      if (msg.includes('OVERPAYMENT_NOT_ALLOWED')) {
        return errorResponse(
          409,
          'OVERPAYMENT_NOT_ALLOWED',
          correlationId,
          'Payment exceeds the remaining invoice balance.'
        );
      }
      if (msg.includes('INVOICE_VOID')) {
        return errorResponse(
          409,
          'INVOICE_VOID',
          correlationId,
          'Payments cannot be recorded for a void invoice.'
        );
      }
      if (msg.includes('INVOICE_ALREADY_PAID')) {
        return errorResponse(
          409,
          'INVOICE_ALREADY_PAID',
          correlationId,
          'This invoice is already fully paid.'
        );
      }
      if (msg.includes('INVOICE_NOT_FOUND')) {
        return errorResponse(
          404,
          'INVOICE_NOT_FOUND',
          correlationId,
          'Invoice not found.'
        );
      }
      if (msg.includes('INSUFFICIENT_PERMISSIONS')) {
        return errorResponse(
          403,
          'AGENT_PERMISSION_REQUIRED',
          correlationId,
          'Agent permission is required.'
        );
      }
      if (rpcError.code === '42883' || msg.includes('record_invoice_payment')) {
        return errorResponse(
          503,
          'SALES_SCHEMA_NOT_READY',
          correlationId,
          'Sales database migration is not available.'
        );
      }

      return errorResponse(
        500,
        'PAYMENT_RECORD_FAILED',
        correlationId,
        'Unable to record payment.'
      );
    }

    const { data: updatedInvoice, error: hydrationError } = await supabase
      .from('invoices')
      .select(
        '*, contacts(id, name, phone, email), invoice_items(*), invoice_payments(*)'
      )
      .eq('id', invoiceId)
      .eq('account_id', ctx.accountId)
      .single();

    if (hydrationError || !updatedInvoice) {
      console.error('[invoice payment hydration]', {
        requestId: correlationId,
        invoiceId,
        code: hydrationError?.code,
        message: hydrationError?.message,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            invoice_id: invoiceId,
            payment_id: (rpcResult as { payment_id?: string }).payment_id,
            amount_paid: (rpcResult as { amount_paid?: number }).amount_paid,
            balance_due: (rpcResult as { balance_due?: number }).balance_due,
            status: (rpcResult as { status?: string }).status,
            currency: (rpcResult as { currency?: string }).currency,
          },
          warning: 'INVOICE_DETAILS_REFRESH_REQUIRED',
          requestId: correlationId,
        },
        {
          status: 201,
          headers: {
            ...PRIVATE_HEADERS,
            'X-Request-Id': correlationId,
          },
        }
      );
    }

    try {
      await dispatchCrmEvent({
        accountId: ctx.accountId,
        eventType: 'deal.updated',
        payload: {
          invoiceId,
          paymentId: (rpcResult as { payment_id?: string }).payment_id,
          amount: paymentAmount,
          newStatus: (rpcResult as { status?: string }).status,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedInvoice,
        message: `Payment of ${(rpcResult as { currency?: string }).currency || 'INR'} ${paymentAmount} recorded successfully.`,
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
    console.error('[invoice payment unhandled error]', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'PAYMENT_RECORD_FAILED',
      correlationId,
      'Unable to record payment.'
    );
  }
}
