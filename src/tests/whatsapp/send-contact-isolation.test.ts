import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/whatsapp/send/route';

// Mock appwrite-server-compat
vi.mock('@/lib/appwrite-server-compat', () => {
  const mockContacts: Array<{ id: string; account_id: string; phone: string }> =
    [
      {
        id: 'contact-patient-a',
        account_id: 'tenant-1',
        phone: '+1234567890',
      },
      {
        id: 'contact-patient-b',
        account_id: 'tenant-1',
        phone: '+1987654321',
      },
    ];

  const mockAppwrite = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { account_id: 'tenant-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: null, error: true }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  const mockAdmin = {
    from: (table: string) => {
      if (table === 'contacts') {
        return {
          select: () => {
            const chain = {
              eq: (_col: string, val: string) => {
                const subChain = {
                  eq: (_col2: string, accountId: string) => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data:
                        mockContacts.find(
                          (c) => c.id === val && c.account_id === accountId
                        ) || null,
                      error: null,
                    }),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                  or: () => ({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
                return subChain;
              },
              or: () => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
            return chain;
          },
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Insert failed'),
              }),
            }),
          }),
        };
      }
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Insert failed'),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  return {
    createClient: vi.fn().mockResolvedValue(mockAppwrite),
    appwriteAdmin: vi.fn().mockReturnValue(mockAdmin),
  };
});

describe('WhatsApp Send Route Contact Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed when contact_id does not exist in tenant', async () => {
    const req = new Request('http://localhost/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: 'non-existent-contact',
        message: 'Hello',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toContain('Contact not found or access denied');
  });

  it('fails closed when phone resolution and creation fail, never picking an existing contact fallback', async () => {
    const req = new Request('http://localhost/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+15550009999',
        message: 'Hello',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain(
      'Could not resolve conversation for recipient'
    );
  });

  it('fails closed when conversation_id belongs to another tenant or does not exist', async () => {
    const req = new Request('http://localhost/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: 'conv-of-another-tenant',
        message: 'Hello',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toContain('Conversation not found or access denied');
  });
});
