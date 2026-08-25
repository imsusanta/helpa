import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorded: Array<{ table: string; filters: Record<string, unknown> }> = [];

vi.mock('@/lib/cron/security', () => ({
  authorizeCronRequest: () => ({ authorized: true }),
}));

vi.mock('@/lib/automations/meta-send', () => ({
  engineSendText: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa-1' }),
  engineSendDocument: vi
    .fn()
    .mockResolvedValue({ whatsapp_message_id: 'wa-1' }),
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const resultFor = () => {
        recorded.push({ table, filters: { ...filters } });
        if (table === 'broadcasts' && !filters.id) {
          return {
            data: [
              {
                id: 'camp-1',
                account_id: 'tenant-a',
                status: 'scheduled',
                scheduled_at: '2000-01-01T00:00:00.000Z',
                audience_filter: { type: 'all' },
                message_body: 'Hello {{PatientName}}',
                name: 'All patients',
              },
            ],
            error: null,
          };
        }
        if (table === 'contacts') {
          return {
            data: [{ id: 'c-1', name: 'Pat', phone: '+15550001' }],
            error: null,
          };
        }
        if (table === 'conversations') {
          return { data: { id: 'conv-1' }, error: null };
        }
        if (table === 'accounts') {
          return { data: { name: 'Clinic A' }, error: null };
        }
        return { data: [], error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        in: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        gte: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        lte: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        lt: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          const res = resultFor();
          const row = Array.isArray(res.data) ? res.data[0] || null : res.data;
          return { data: row, error: null };
        },
        single: async () => {
          const res = resultFor();
          const row = Array.isArray(res.data) ? res.data[0] || null : res.data;
          return { data: row, error: null };
        },
        then: (resolve: (value: unknown) => unknown) => resolve(resultFor()),
      };
      return chain;
    },
  }),
}));

import { GET } from '@/app/api/cron/campaigns/route';

describe('GET /api/cron/campaigns tenant scoping', () => {
  beforeEach(() => {
    recorded.length = 0;
  });

  it('scopes audience resolution to the campaign account_id', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/campaigns', {
        headers: { 'x-cron-secret': 'test' },
      })
    );
    expect(res.status).toBe(200);

    const contactLookups = recorded.filter((r) => r.table === 'contacts');
    expect(contactLookups.length).toBeGreaterThan(0);
    for (const lookup of contactLookups) {
      expect(lookup.filters.account_id).toBe('tenant-a');
    }
  });
});
