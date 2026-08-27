import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/invoices/route';
import * as accountAuth from '@/lib/auth/account';
import * as serverDb from '@/lib/supabase/server';

const MOCK_ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MOCK_USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';

function mockViewerRole(): void {
  vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
    accountId: MOCK_ACCOUNT_ID,
    userId: MOCK_USER_ID,
    role: 'viewer',
  } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);
}

function request(url = 'http://localhost/api/invoices'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function createQueryMock(result: { data: unknown[]; count: number | null; error: null | { code: string; message: string } }) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  return query;
}

describe('invoice list API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads invoices without relying on ambiguous nested PostgREST relationships', async () => {
    mockViewerRole();

    const invoices = [
      {
        id: 'invoice-1',
        account_id: MOCK_ACCOUNT_ID,
        contact_id: 'contact-1',
        invoice_number: 'INV-2026-0001',
        status: 'draft',
      },
    ];

    const invoiceItems = [
      {
        id: 'item-1',
        account_id: MOCK_ACCOUNT_ID,
        invoice_id: 'invoice-1',
        description: 'Consultation',
        quantity: 1,
        unit_price: 2000,
        discount: 0,
        tax_rate: 0,
        line_total: 2000,
        position: 0,
      },
    ];

    const invoicePayments = [
      {
        id: 'payment-1',
        account_id: MOCK_ACCOUNT_ID,
        invoice_id: 'invoice-1',
        amount: 500,
        payment_date: '2026-08-27',
        payment_method: 'upi',
      },
    ];

    const contact = {
      id: 'contact-1',
      name: 'Test Customer',
      phone: '+919999999999',
      email: 'test@example.com',
    };

    const invoicesQuery = createQueryMock({
      data: invoices,
      count: 1,
      error: null,
    });
    const itemsQuery = createQueryMock({ data: invoiceItems, count: null, error: null });
    const paymentsQuery = createQueryMock({ data: invoicePayments, count: null, error: null });
    const contactsQuery = createQueryMock({ data: [contact], count: null, error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === 'invoices') return { select: vi.fn().mockReturnValue(invoicesQuery) };
      if (table === 'invoice_items') return { select: vi.fn().mockReturnValue(itemsQuery) };
      if (table === 'invoice_payments') return { select: vi.fn().mockReturnValue(paymentsQuery) };
      if (table === 'contacts') return { select: vi.fn().mockReturnValue(contactsQuery) };
      throw new Error(`Unexpected table ${table}`);
    });

    vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
      from: fromMock,
    } as unknown as ReturnType<typeof serverDb.getAdminClient>);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data[0].id).toBe('invoice-1');
    expect(body.data[0].contacts.name).toBe('Test Customer');
    expect(body.data[0].invoice_items).toHaveLength(1);
    expect(body.data[0].invoice_payments).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith('invoices');
    expect(fromMock).toHaveBeenCalledWith('invoice_items');
    expect(fromMock).toHaveBeenCalledWith('invoice_payments');
    expect(fromMock).toHaveBeenCalledWith('contacts');
  });

  it('returns a sanitized error when the base invoice query fails', async () => {
    mockViewerRole();

    const invoicesQuery = createQueryMock({
      data: [],
      count: null,
      error: { code: 'PGRST201', message: 'ambiguous relationship details' },
    });

    vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
      from: () => ({ select: vi.fn().mockReturnValue(invoicesQuery) }),
    } as unknown as ReturnType<typeof serverDb.getAdminClient>);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('INVOICES_FETCH_FAILED');
    expect(body.message).toBe('Unable to load invoices.');
    expect(JSON.stringify(body)).not.toContain('ambiguous relationship');
  });
});
