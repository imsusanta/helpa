import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, POST, PATCH, DELETE } from './route';

const mockKbDb = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn(async () => ({
    accountId: 'account-kb-test',
    userId: 'user-kb-test',
    role: 'agent',
    appwrite: {
      from: (_tableName: string) => ({
        select: (_cols?: string) => ({
          eq: (_col: string, val: unknown) => {
            const results = mockKbDb.entries.filter(
              (e) => e.account_id === val
            );
            return Promise.resolve({ data: results, error: null });
          },
        }),
        insert: (data: Record<string, unknown>) => {
          const entry = {
            id: `kb-${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data,
          };
          mockKbDb.entries.push(entry);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: entry, error: null }),
            }),
          };
        },
        update: (updates: Record<string, unknown>) => ({
          eq: (_col1: string, idVal: unknown) => ({
            eq: (_col2: string, accVal: unknown) => {
              const item = mockKbDb.entries.find(
                (e) => e.id === idVal && e.account_id === accVal
              );
              if (item) Object.assign(item, updates);
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: item || null,
                      error: item ? null : new Error('Not found'),
                    }),
                }),
              };
            },
          }),
        }),
        delete: () => ({
          eq: (_col1: string, idVal: unknown) => ({
            eq: (_col2: string, accVal: unknown) => {
              const idx = mockKbDb.entries.findIndex(
                (e) => e.id === idVal && e.account_id === accVal
              );
              if (idx !== -1) mockKbDb.entries.splice(idx, 1);
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    },
  })),
  toErrorResponse: vi.fn((err) => new Response(String(err), { status: 500 })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, remaining: 10, reset: 60 })),
  rateLimitResponse: vi.fn(
    () => new Response('Too Many Requests', { status: 429 })
  ),
  RATE_LIMITS: { adminAction: { limit: 100, windowMs: 60000 } },
}));

describe('Knowledge Base API Route Handler', () => {
  beforeEach(() => {
    mockKbDb.entries = [];
  });

  it('lists entries via GET', async () => {
    mockKbDb.entries.push({
      id: 'kb-list-1',
      account_id: 'account-kb-test',
      category: 'faq',
      question_title: 'Refund terms?',
      answer_content: 'Full refund before 14 days.',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.length).toBe(1);
    expect(json[0].question_title).toBe('Refund terms?');
  });

  it('creates an entry via POST', async () => {
    const req = new Request('http://localhost/api/account/kb', {
      method: 'POST',
      body: JSON.stringify({
        category: 'pricing',
        question_title: 'Package payment terms?',
        answer_content: '50% advance to confirm.',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.question_title).toBe('Package payment terms?');
    expect(json.category).toBe('pricing');
  });

  it('updates an entry via PATCH with ID in body (verifies PUT->PATCH fix)', async () => {
    mockKbDb.entries.push({
      id: 'kb-entry-123',
      account_id: 'account-kb-test',
      category: 'faq',
      question_title: 'Old Title',
      answer_content: 'Old Content',
    });

    const req = new Request('http://localhost/api/account/kb', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'kb-entry-123',
        question_title: 'Updated Title',
        answer_content: 'Updated Content',
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question_title).toBe('Updated Title');
    expect(json.answer_content).toBe('Updated Content');
  });

  it('deletes an entry via DELETE with search param id', async () => {
    mockKbDb.entries.push({
      id: 'kb-entry-to-del',
      account_id: 'account-kb-test',
      category: 'faq',
      question_title: 'To delete',
      answer_content: 'To delete',
    });

    const req = new Request(
      'http://localhost/api/account/kb?id=kb-entry-to-del',
      {
        method: 'DELETE',
      }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockKbDb.entries.length).toBe(0);
  });
});
