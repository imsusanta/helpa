import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every terminal query issued against dbAdmin.from('contacts') records the
// exact set of `.eq(...)` filters that were active when it resolved. The
// regression this guards against is a retry that re-ran the lookup with the
// `account_id` filter stripped off — so we can assert on the filters, not
// just the count.
const { contactsTerminalCalls } = vi.hoisted(() => ({
  contactsTerminalCalls: [] as Array<Record<string, unknown>>,
}));

// Resolve the tenant deterministically so the route reaches contact
// validation without depending on the profiles fallback path.
vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: vi
    .fn()
    .mockResolvedValue({ accountId: 'tenant-1', userId: 'user-1', role: 'agent' }),
  requireRole: vi
    .fn()
    .mockResolvedValue({ accountId: 'tenant-1', userId: 'user-1', role: 'agent' }),
}));

vi.mock('@/lib/db/server', () => {
  const mockAppwrite = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  };

  // A fluent contacts query builder that captures its filters and returns
  // no rows — simulating a contact_id that belongs to a *different* tenant,
  // so the account-scoped lookup legitimately finds nothing.
  const makeContactsBuilder = () => {
    // All chain objects share this `filters` closure, so a terminal call
    // sees every `.eq(...)` accumulated along the chain that produced it.
    const filters: Record<string, unknown> = {};
    const record = () => {
      contactsTerminalCalls.push({ ...filters });
    };
    const chain = (): Record<string, unknown> => ({
      select: () => chain(),
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain();
      },
      maybeSingle: vi.fn(async () => {
        record();
        return { data: null, error: null };
      }),
      single: vi.fn(async () => {
        record();
        return { data: null, error: null };
      }),
      limit: vi.fn(async () => {
        record();
        return { data: [], error: null };
      }),
    });
    return chain();
  };

  const mockAdmin = {
    from: (table: string) => {
      if (table === 'contacts') {
        return makeContactsBuilder();
      }
      // Defensive default — not exercised here, since the route returns 404
      // at contact validation before touching any other table.
      const makeChain = (): Record<string, unknown> => ({
        select: () => makeChain(),
        insert: () => makeChain(),
        update: () => makeChain(),
        eq: () => makeChain(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      return makeChain();
    },
  };

  return {
    createClient: vi.fn().mockResolvedValue(mockAppwrite),
    getAdminClient: vi.fn().mockReturnValue(mockAdmin),
  };
});

import { POST } from '@/app/api/whatsapp/send/route';

describe('WhatsApp send — cross-tenant contact validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contactsTerminalCalls.length = 0;
  });

  it('returns 404 for a contact_id owned by another tenant and never retries without account_id', async () => {
    const req = new Request('http://localhost/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: 'contact-cross-tenant',
        message: 'Hello',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    // Fails closed: the account-scoped lookup found nothing, so access is denied.
    expect(res.status).toBe(404);
    expect(json.error).toBe('Contact not found or access denied');

    // The scoped validation query ran exactly once...
    expect(contactsTerminalCalls).toHaveLength(1);
    // ...and it carried the tenant filter.
    expect(contactsTerminalCalls[0]).toMatchObject({
      id: 'contact-cross-tenant',
      account_id: 'tenant-1',
    });

    // Regression: the deleted retry re-ran the lookup by id alone. No
    // contacts query may reach the DB filtering on id without account_id.
    const unscopedRetries = contactsTerminalCalls.filter(
      (filters) => 'id' in filters && !('account_id' in filters)
    );
    expect(unscopedRetries).toHaveLength(0);
  });
});
