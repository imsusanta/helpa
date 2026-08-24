import { afterEach, describe, expect, it, vi } from 'vitest';
import { salesApi } from '@/lib/sales/api-client';

function mockJsonResponse(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-sales-test',
        },
      })
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sales API client workflow contracts', () => {
  it('normalizes customer aggregate fields for the existing customer UI', async () => {
    mockJsonResponse({
      success: true,
      data: [
        {
          id: 'contact-1',
          name: 'Acme',
          total_deals: 2,
          total_invoices: 3,
          total_quotations: 4,
          total_paid: 12500,
          total_deals_value: 48000,
        },
      ],
    });

    const rows = await salesApi<
      Array<{
        dealsCount: number;
        invoicesCount: number;
        quotationsCount: number;
        totalRevenue: number;
        openDealsValue: number;
      }>
    >('/api/customers');

    expect(rows[0]).toMatchObject({
      dealsCount: 2,
      invoicesCount: 3,
      quotationsCount: 4,
      totalRevenue: 12500,
      openDealsValue: 48000,
    });
  });

  it('preserves the payment envelope used to refresh invoice details', async () => {
    mockJsonResponse({
      success: true,
      data: { id: 'invoice-1', status: 'paid', amount_paid: 5000 },
      message: 'Payment recorded successfully.',
    });

    const response = await salesApi<{
      data: { id: string; status: string; amount_paid: number };
      message: string;
    }>('/api/invoices/invoice-1/payments', { method: 'POST' });

    expect(response.message).toBe('Payment recorded successfully.');
    expect(response.data).toMatchObject({
      id: 'invoice-1',
      status: 'paid',
      amount_paid: 5000,
    });
  });

  it('preserves quotation conversion confirmation metadata', async () => {
    mockJsonResponse({
      success: true,
      data: { id: 'invoice-2', invoice_number: 'INV-2026-0002' },
      message: 'Quotation converted to Invoice INV-2026-0002',
    });

    const response = await salesApi<{
      data: { id: string; invoice_number: string };
      message: string;
    }>('/api/quotations/quote-1/convert-to-invoice', { method: 'POST' });

    expect(response.message).toContain('INV-2026-0002');
    expect(response.data.id).toBe('invoice-2');
  });

  it('continues to unwrap normal Sales responses', async () => {
    mockJsonResponse({
      success: true,
      data: [{ id: 'deal-1' }],
      requestId: 'req-sales-test',
    });

    const deals = await salesApi<Array<{ id: string }>>('/api/deals');

    expect(deals).toEqual([{ id: 'deal-1' }]);
  });
});
