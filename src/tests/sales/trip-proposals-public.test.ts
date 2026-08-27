import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('@/lib/auth/account', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/account')>(
      '@/lib/auth/account'
    );
  return {
    ...actual,
    requireRole: vi.fn(),
  };
});

import { GET as getPublicProposal } from '@/app/api/public/trip-proposals/[token]/route';
import {
  GET as getQuotations,
  POST as createQuotation,
} from '@/app/api/quotations/route';
import { requireRole } from '@/lib/auth/account';
import {
  presentQuotation,
  presentQuotationItem,
} from '@/lib/sales/quotation-presenter';
import { isPublicRoute } from '@/proxy';

const TOKEN = '11111111-1111-1111-1111-111111111111';
const ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';

function listQuery(result: {
  data: unknown;
  error: unknown;
  count?: number | null;
}) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'or', 'order']) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.range = vi.fn().mockResolvedValue(result);
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  return query;
}

describe('trip proposal public access', () => {
  it('allows the customer proposal page without a session', () => {
    expect(isPublicRoute(`/proposal/${TOKEN}`)).toBe(true);
    expect(isPublicRoute(`/api/public/trip-proposals/${TOKEN}`)).toBe(true);
    expect(isPublicRoute('/trip-proposals')).toBe(false);
  });

  it('rejects short tokens', async () => {
    const res = await getPublicProposal(new Request('http://localhost'), {
      params: Promise.resolve({ token: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the token does not match a travel proposal', async () => {
    mockFrom.mockReturnValue(listQuery({ data: null, error: null }));
    const res = await getPublicProposal(new Request('http://localhost'), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  it('selects canonical sales columns and aliases tax for the customer page', async () => {
    const query = listQuery({
      data: {
        quotation_number: 'QT-2026-0001',
        status: 'sent',
        valid_until: '2026-09-01',
        subtotal: 10000,
        tax_total: 500,
        discount_total: 200,
        total: 10300,
        currency: 'INR',
        notes: null,
        terms: 'Package subject to availability.',
        created_at: '2026-08-27T00:00:00.000Z',
        public_token: TOKEN,
        travel_details: {
          proposal_title: 'Goa Family Holiday',
          destination: 'Goa',
          itinerary: [],
        },
        contacts: { name: 'Asha', phone: '9999999999' },
        quotation_items: [
          {
            description: 'Hotel: 4-star stay',
            quantity: 1,
            unit_price: 10000,
            line_total: 10000,
          },
        ],
      },
      error: null,
    });
    mockFrom.mockReturnValue(query);

    const res = await getPublicProposal(new Request('http://localhost'), {
      params: Promise.resolve({ token: TOKEN }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(String(query.select.mock.calls[0][0])).toContain('tax_total');
    expect(String(query.select.mock.calls[0][0])).not.toContain('tax_amount');
    expect(String(query.select.mock.calls[0][0])).toContain('line_total');
    expect(query.eq).toHaveBeenCalledWith('public_token', TOKEN);
    expect(body.data.tax_amount).toBe(500);
    expect(body.data.discount_amount).toBe(200);
    expect(body.data.quotation_items[0].total).toBe(10000);
  });
});

describe('quotation presenter', () => {
  it('maps tax_total and line_total onto the UI aliases', () => {
    const presented = presentQuotation({
      tax_total: 180,
      discount_total: 50,
      quotation_items: [{ line_total: 2200 }],
    }) as {
      tax_amount: number;
      discount_amount: number;
      quotation_items: Array<{ total: number }>;
    };
    expect(presented.tax_amount).toBe(180);
    expect(presented.discount_amount).toBe(50);
    expect(presented.quotation_items[0].total).toBe(2200);
    expect(presentQuotationItem({ line_total: 99 })).toEqual(
      expect.objectContaining({ total: 99, line_total: 99 })
    );
  });
});

describe('quotations list search', () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({
      accountId: ACCOUNT_ID,
      userId: USER_ID,
      role: 'viewer',
    } as unknown as Awaited<ReturnType<typeof requireRole>>);
  });

  it('searches destination and proposal title in travel_details', async () => {
    const query = listQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    const res = await getQuotations(
      new NextRequest('http://localhost/api/quotations?search=Goa')
    );
    expect(res.status).toBe(200);
    expect(query.or).toHaveBeenCalledWith(
      expect.stringContaining('travel_details->>destination.ilike.%Goa%')
    );
    expect(query.or).toHaveBeenCalledWith(
      expect.stringContaining('travel_details->>proposal_title.ilike.%Goa%')
    );
  });
});

describe('quotation create', () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({
      accountId: ACCOUNT_ID,
      userId: USER_ID,
      role: 'agent',
    } as unknown as Awaited<ReturnType<typeof requireRole>>);
    mockRpc.mockResolvedValue({ data: 'QT-2026-0009', error: null });
  });

  it('writes canonical tax columns and prefixes the service category', async () => {
    const quotationPayloads: unknown[] = [];
    const itemPayloads: unknown[] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'quotations') {
        return {
          insert: (payload: unknown) => {
            quotationPayloads.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'quote-1',
                    tax_total: 0,
                    discount_total: 0,
                    total: 4000,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      return {
        insert: (payload: unknown) => {
          itemPayloads.push(payload);
          return {
            select: async () => ({ data: payload, error: null }),
          };
        },
      };
    });

    const res = await createQuotation(
      new NextRequest('http://localhost/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: 'contact-1',
          items: [
            {
              description: '4-star stay',
              quantity: 1,
              unit_price: 4000,
              category: 'Hotel',
            },
          ],
          travel_details: { destination: 'Goa', proposal_title: 'Goa Trip' },
        }),
      })
    );

    expect(res.status).toBe(201);
    expect(quotationPayloads[0]).toEqual(
      expect.objectContaining({
        created_by: USER_ID,
        tax_total: 0,
        discount_total: 0,
      })
    );
    expect(itemPayloads[0]).toEqual([
      expect.objectContaining({
        description: 'Hotel: 4-star stay',
        line_total: 4000,
        position: 0,
      }),
    ]);
  });
});
