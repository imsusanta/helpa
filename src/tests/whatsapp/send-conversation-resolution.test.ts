import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/whatsapp/send/route';

// Regression: a contact may hold one conversation per channel (unique index
// on account_id/contact_id/channel; multichannel inbound creates them). The
// send route's resolution previously used a bare `.maybeSingle()` keyed on
// (contact_id, account_id) which errors when 2+ rows exist, then tried to
// insert a duplicate WhatsApp conversation (unique violation), and failed the
// request with 400 "Could not resolve conversation for recipient".

const state = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  conversationInserts: [] as Array<Record<string, unknown>>,
  detailFetchIds: [] as string[],
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: vi.fn().mockResolvedValue({
    accountId: 'tenant-1',
    userId: 'user-1',
    role: 'agent',
  }),
  requireRole: vi.fn().mockResolvedValue({
    accountId: 'tenant-1',
    userId: 'user-1',
    role: 'agent',
  }),
  toErrorResponse: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401 as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    status = 403 as const;
  },
}));

vi.mock('@/lib/db/server', () => {
  function makeBuilder(table: string) {
    const filters: Record<string, unknown> = {};
    let limitN: number | null = null;
    let selectCols = '';
    let inserting = false;

    const builder: Record<string, unknown> = {
      select: (cols?: string) => {
        selectCols = cols || '';
        return builder;
      },
      insert: (payload: Record<string, unknown>) => {
        inserting = true;
        if (table === 'conversations') state.conversationInserts.push(payload);
        return builder;
      },
      order: () => builder,
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      maybeSingle: async () => {
        if (table === 'contacts') {
          const found =
            filters.id === 'cnt-multi' && filters.account_id === 'tenant-1';
          return { data: found ? { id: 'cnt-multi' } : null, error: null };
        }
        if (table === 'conversations') {
          let rows = state.conversations.filter((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v)
          );
          if (limitN != null) rows = rows.slice(0, limitN);
          if (rows.length > 1) {
            // PostgREST object coercion fails on multiple rows.
            return {
              data: null,
              error: { code: 'PGRST116', message: 'multiple rows returned' },
            };
          }
          return { data: rows[0] ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (inserting && table === 'conversations') {
          // Simulate the unique violation on (account, contact, channel).
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key' },
          };
        }
        if (table === 'conversations' && selectCols.includes('contact')) {
          state.detailFetchIds.push(String(filters.id));
          return { data: null, error: { message: 'not found' } };
        }
        return { data: null, error: { message: 'not found' } };
      },
    };
    return builder;
  }

  const client = { from: (table: string) => makeBuilder(table) };
  return {
    getAdminClient: () => client,
    createClient: async () => client,
  };
});

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('WhatsApp send conversation resolution', () => {
  beforeEach(() => {
    state.conversations.length = 0;
    state.conversationInserts.length = 0;
    state.detailFetchIds.length = 0;
  });

  it('resolves the WhatsApp thread when the contact has one conversation per channel', async () => {
    state.conversations.push(
      {
        id: 'conv-sms',
        contact_id: 'cnt-multi',
        account_id: 'tenant-1',
        channel: 'sms',
        updated_at: '2026-08-25T00:00:00Z',
      },
      {
        id: 'conv-wa',
        contact_id: 'cnt-multi',
        account_id: 'tenant-1',
        channel: 'whatsapp',
        updated_at: '2026-08-20T00:00:00Z',
      }
    );

    const res = await POST(
      makeRequest({
        contact_id: 'cnt-multi',
        message_type: 'text',
        content_text: 'hello',
      })
    );
    const json = await res.json();

    // Resolution must succeed (the request then fails later in this stub at
    // the conversation detail fetch, which is a different error).
    expect(json.error).not.toBe('Could not resolve conversation for recipient');
    expect(state.detailFetchIds).toEqual(['conv-wa']);
    expect(state.conversationInserts).toHaveLength(0);
  });

  it('recovers via re-lookup when the insert loses a unique-constraint race', async () => {
    // First lookups see nothing (simulating a race where the webhook creates
    // the thread between lookup and insert); the insert then unique-violates.
    // After the failed inserts the retry lookup must find the row.
    let lookups = 0;
    const original = state.conversations;
    const raceRow = {
      id: 'conv-raced',
      contact_id: 'cnt-multi',
      account_id: 'tenant-1',
      channel: 'whatsapp',
      updated_at: '2026-08-26T00:00:00Z',
    };
    // Make the row appear only after the first two (pre-insert) lookups.
    Object.defineProperty(state, 'conversations', {
      configurable: true,
      get() {
        lookups += 1;
        return lookups > 2 ? [raceRow] : [];
      },
    });

    try {
      const res = await POST(
        makeRequest({
          contact_id: 'cnt-multi',
          message_type: 'text',
          content_text: 'hello',
        })
      );
      const json = await res.json();

      expect(json.error).not.toBe(
        'Could not resolve conversation for recipient'
      );
      expect(state.detailFetchIds).toEqual(['conv-raced']);
    } finally {
      Object.defineProperty(state, 'conversations', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });
});
