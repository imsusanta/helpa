import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { requireTravelWorkplace } from '@/lib/travel/access';
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

    const ctx = await requireTravelWorkplace('agent');
    const supabase = getSupabaseAdminClient();

    // Call atomic PostgreSQL RPC conversion
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'convert_quotation_to_invoice',
      {
        p_account_id: ctx.accountId,
        p_quotation_id: quotationId,
        p_user_id: ctx.userId,
      }
    );

    if (rpcError) {
      console.error('[quotation conversion]', {
        requestId: correlationId,
        code: rpcError.code,
        message: rpcError.message,
      });

      const message = rpcError.message || '';

      if (message.includes('ALREADY_CONVERTED')) {
        return errorResponse(
          409,
          'ALREADY_CONVERTED',
          correlationId,
          'Quotation is already converted.'
        );
      }

      if (message.includes('QUOTATION_NOT_FOUND')) {
        return errorResponse(
          404,
          'QUOTATION_NOT_FOUND',
          correlationId,
          'Quotation not found.'
        );
      }

      if (message.includes('INSUFFICIENT_PERMISSIONS')) {
        return errorResponse(
          403,
          'AGENT_PERMISSION_REQUIRED',
          correlationId,
          'Agent permission is required.'
        );
      }

      if (
        rpcError.code === '42883' ||
        message.includes('convert_quotation_to_invoice')
      ) {
        return errorResponse(
          503,
          'SALES_SCHEMA_NOT_READY',
          correlationId,
          'Sales database migration is not available.'
        );
      }

      return errorResponse(
        500,
        'QUOTATION_CONVERSION_FAILED',
        correlationId,
        'Unable to convert quotation.'
      );
    }

    const invoiceId = (rpcResult as { invoice_id?: string })?.invoice_id;
    if (!invoiceId) {
      return errorResponse(
        500,
        'QUOTATION_CONVERSION_FAILED',
        correlationId,
        'Unable to convert quotation.'
      );
    }

    const { data: newInvoice, error: hydrationError } = await supabase
      .from('invoices')
      .select('*, contacts(id, name, phone, email), invoice_items(*)')
      .eq('id', invoiceId)
      .eq('account_id', ctx.accountId)
      .single();

    if (hydrationError || !newInvoice) {
      console.error('[quotation conversion hydration]', {
        requestId: correlationId,
        invoiceId,
        code: hydrationError?.code,
        message: hydrationError?.message,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            id: invoiceId,
            invoice_number: (rpcResult as { invoice_number?: string })
              .invoice_number,
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
          quotationId,
          invoiceId,
          invoiceNumber: (rpcResult as { invoice_number?: string })
            ?.invoice_number,
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
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[quotation conversion unhandled error]', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'QUOTATION_CONVERSION_FAILED',
      correlationId,
      'Unable to convert quotation.'
    );
  }
}
