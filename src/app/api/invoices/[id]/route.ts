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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (invoiceError) {
      console.error('[invoices] GET by id base query error:', {
        requestId: correlationId,
        code: invoiceError.code,
        message: invoiceError.message,
      });
      return errorResponse(
        500,
        'INVOICE_FETCH_FAILED',
        correlationId,
        'Unable to load invoice.'
      );
    }

    if (!invoice) {
      return errorResponse(
        404,
        'INVOICE_NOT_FOUND',
        correlationId,
        'Invoice not found.'
      );
    }

    const [contactResult, itemsResult, paymentsResult] = await Promise.all([
      invoice.contact_id
        ? supabase
            .from('contacts')
            .select('id, name, phone, email, metadata')
            .eq('id', invoice.contact_id)
            .eq('account_id', ctx.accountId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('account_id', ctx.accountId)
        .order('position', { ascending: true }),
      supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('account_id', ctx.accountId)
        .order('payment_date', { ascending: false }),
    ]);

    if (contactResult.error || itemsResult.error || paymentsResult.error) {
      console.error('[invoices] GET by id related data error:', {
        requestId: correlationId,
        contactCode: contactResult.error?.code,
        contactMessage: contactResult.error?.message,
        itemsCode: itemsResult.error?.code,
        itemsMessage: itemsResult.error?.message,
        paymentsCode: paymentsResult.error?.code,
        paymentsMessage: paymentsResult.error?.message,
      });
      return errorResponse(
        500,
        'INVOICE_FETCH_FAILED',
        correlationId,
        'Unable to load invoice.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...invoice,
          contacts: contactResult.data || null,
          invoice_items: itemsResult.data || [],
          invoice_payments: paymentsResult.data || [],
        },
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
    console.error('[invoices] GET by id unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'INVOICE_FETCH_FAILED',
      correlationId,
      'Unable to load invoice.'
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[invoices] DELETE error:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'INVOICE_DELETE_FAILED',
        correlationId,
        'Unable to delete invoice.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Invoice deleted successfully',
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[invoices] DELETE unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'INVOICE_DELETE_FAILED',
      correlationId,
      'Unable to delete invoice.'
    );
  }
}
