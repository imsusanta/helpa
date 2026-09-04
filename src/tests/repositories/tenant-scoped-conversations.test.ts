/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import {
  TenantContextError,
  assertTenantContext,
} from '@/core/repositories/tenant-context';
import {
  getConversationsRepository,
  SupabaseConversationsRepository,
} from '@/core/repositories/conversations';

function createMockSupabase(
  initialConversations: any[] = [],
  initialMessages: any[] = []
) {
  const conversations = [...initialConversations];
  const messages = [...initialMessages];

  const client: any = {
    from: vi.fn((table: string) => {
      const dataStore = table === 'conversations' ? conversations : messages;
      const filters: Array<(row: any) => boolean> = [];
      let isMaybeSingle = false;
      let limitCount: number | null = null;
      let orderCol: string | null = null;
      let orderAsc = true;

      const builder: any = {
        select: vi.fn((_fields?: string) => builder),
        eq: vi.fn((col: string, val: any) => {
          filters.push((row) => row[col] === val);
          return builder;
        }),
        order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
          orderCol = col;
          orderAsc = opts?.ascending ?? true;
          return builder;
        }),
        limit: vi.fn((count: number) => {
          limitCount = count;
          return builder;
        }),
        maybeSingle: vi.fn(() => {
          isMaybeSingle = true;
          return builder;
        }),
        single: vi.fn(() => {
          isMaybeSingle = false;
          return builder;
        }),
        then: (resolve: any, _reject: any) => {
          let rows = dataStore.filter((row) => filters.every((f) => f(row)));
          if (orderCol) {
            rows.sort((a, b) => {
              const valA = a[orderCol!];
              const valB = b[orderCol!];
              if (valA < valB) return orderAsc ? -1 : 1;
              if (valA > valB) return orderAsc ? 1 : -1;
              return 0;
            });
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount);
          }
          if (isMaybeSingle) {
            return resolve({ data: rows[0] || null, error: null });
          }
          return resolve({ data: rows, error: null });
        },
      };

      return builder;
    }),
  };

  return { client, conversations, messages };
}

describe('Tenant-Scoped Conversations Repository', () => {
  const TENANT_A = 'tenant-alpha';
  const TENANT_B = 'tenant-bravo';

  const mockConversations = [
    {
      id: 'conv-1',
      account_id: TENANT_A,
      contact_id: 'cnt-1',
      ai_chat_enabled: true,
      last_message_at: '2026-09-04T10:00:00Z',
      created_at: '2026-09-04T09:00:00Z',
    },
    {
      id: 'conv-2',
      account_id: TENANT_B,
      contact_id: 'cnt-2',
      ai_chat_enabled: true,
      last_message_at: '2026-09-04T10:00:00Z',
      created_at: '2026-09-04T09:00:00Z',
    },
  ];

  const mockMessages = [
    {
      id: 'msg-1',
      account_id: TENANT_A,
      conversation_id: 'conv-1',
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Hello from Tenant A',
      created_at: '2026-09-04T09:05:00Z',
    },
    {
      id: 'msg-2',
      account_id: TENANT_A,
      conversation_id: 'conv-1',
      sender_type: 'bot',
      content_type: 'text',
      content_text: 'Welcome to Clinic A',
      created_at: '2026-09-04T09:06:00Z',
    },
    {
      id: 'msg-3',
      account_id: TENANT_B,
      conversation_id: 'conv-2',
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Hello from Tenant B',
      created_at: '2026-09-04T09:10:00Z',
    },
  ];

  describe('Tenant Context & Fail-Closed Guards', () => {
    it('throws TenantContextError if accountId is missing, empty, or whitespace', () => {
      expect(() => getConversationsRepository({ accountId: '' })).toThrow(
        TenantContextError
      );
      expect(() => getConversationsRepository({ accountId: '   ' })).toThrow(
        TenantContextError
      );
      expect(() =>
        assertTenantContext({ accountId: undefined as any })
      ).toThrow(TenantContextError);
    });

    it('initializes successfully with valid tenant context', () => {
      const repo = getConversationsRepository({ accountId: TENANT_A });
      expect(repo.tenantContext.accountId).toBe(TENANT_A);
    });
  });

  describe('getConversationById', () => {
    it('retrieves conversation for matching tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const conv = await repo.getConversationById('conv-1');
      expect(conv).not.toBeNull();
      expect(conv?.id).toBe('conv-1');
      expect(conv?.account_id).toBe(TENANT_A);
    });

    it('fails closed / returns null when attempting to access another tenant conversation', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      // conv-2 belongs to TENANT_B
      const conv = await repo.getConversationById('conv-2');
      expect(conv).toBeNull();
    });

    it('returns null for empty or invalid conversationId', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      expect(await repo.getConversationById('')).toBeNull();
      expect(await repo.getConversationById('   ')).toBeNull();
    });
  });

  describe('getConversationByContact', () => {
    it('retrieves conversation for contact in the active tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const conv = await repo.getConversationByContact('cnt-1');
      expect(conv).not.toBeNull();
      expect(conv?.id).toBe('conv-1');
    });

    it('returns null when contact belongs to another tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      // cnt-2 belongs to TENANT_B
      const conv = await repo.getConversationByContact('cnt-2');
      expect(conv).toBeNull();
    });
  });

  describe('listRecentMessages', () => {
    it('returns recent messages scoped to tenant in descending order', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const messages = await repo.listRecentMessages('conv-1');
      expect(messages.length).toBe(2);
      expect(messages[0].id).toBe('msg-2'); // More recent
      expect(messages[1].id).toBe('msg-1');
      expect(messages[0].content_text).toBe('Welcome to Clinic A');
    });

    it('prevents cross-tenant message access even with a known conversation ID', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      // conv-2 belongs to TENANT_B
      const messages = await repo.listRecentMessages('conv-2');
      expect(messages).toEqual([]);
    });

    it('respects limit parameter', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const messages = await repo.listRecentMessages('conv-1', 1);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('msg-2');
    });
  });

  describe('getMessageById', () => {
    it('retrieves message for active tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const msg = await repo.getMessageById('msg-1');
      expect(msg).not.toBeNull();
      expect(msg?.id).toBe('msg-1');
      expect(msg?.content_text).toBe('Hello from Tenant A');
    });

    it('returns null for message belonging to another tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      // msg-3 belongs to TENANT_B
      const msg = await repo.getMessageById('msg-3');
      expect(msg).toBeNull();
    });
  });

  describe('loadConversationContext', () => {
    it('loads both conversation and message history for active tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const context = await repo.loadConversationContext('conv-1');
      expect(context.conversation).not.toBeNull();
      expect(context.conversation?.id).toBe('conv-1');
      expect(context.messages.length).toBe(2);
      expect(context.messages[0].id).toBe('msg-2');
    });

    it('returns null conversation and empty messages if conversation belongs to another tenant', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const context = await repo.loadConversationContext('conv-2');
      expect(context.conversation).toBeNull();
      expect(context.messages).toEqual([]);
    });

    it('reconciles missing inbound message by fetching and prepending it', async () => {
      // Setup: 15 messages so that an older inbound message fell outside the initial window
      const manyMessages: any[] = [];
      for (let i = 1; i <= 20; i++) {
        manyMessages.push({
          id: `msg-batch-${i}`,
          account_id: TENANT_A,
          conversation_id: 'conv-1',
          sender_type: 'bot',
          content_type: 'text',
          content_text: `Message ${i}`,
          created_at: new Date(1700000000000 + i * 1000).toISOString(),
        });
      }

      // Special inbound message
      const inboundMsg = {
        id: 'msg-inbound-urgent',
        account_id: TENANT_A,
        conversation_id: 'conv-1',
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'Urgent appointment request',
        created_at: new Date(1699999999000).toISOString(),
      };
      manyMessages.push(inboundMsg);

      const { client } = createMockSupabase(mockConversations, manyMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      // When loading with inboundMessageId, it should ensure msg-inbound-urgent is in messages
      const context = await repo.loadConversationContext('conv-1', {
        limit: 15,
        inboundMessageId: 'msg-inbound-urgent',
      });

      expect(context.conversation).not.toBeNull();
      expect(context.messages.some((m) => m.id === 'msg-inbound-urgent')).toBe(
        true
      );
      expect(context.messages[0].id).toBe('msg-inbound-urgent');
    });

    it('does not duplicate inbound message if it is already in fetched history', async () => {
      const { client } = createMockSupabase(mockConversations, mockMessages);
      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        client
      );

      const context = await repo.loadConversationContext('conv-1', {
        inboundMessageId: 'msg-1',
      });

      const count = context.messages.filter((m) => m.id === 'msg-1').length;
      expect(count).toBe(1);
    });

    it('handles fallback query with limit 50 when primary query is empty', async () => {
      let callCount = 0;
      const customClient: any = {
        from: vi.fn((table: string) => {
          if (table === 'conversations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockConversations[0],
                error: null,
              }),
            };
          }
          if (table === 'messages') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn((n: number) => {
                callCount++;
                if (callCount === 1) {
                  // Primary query returns empty
                  return Promise.resolve({ data: [], error: null });
                }
                // Fallback query (limit 50) returns messages
                expect(n).toBe(50);
                return Promise.resolve({
                  data: [
                    {
                      id: 'msg-fallback-1',
                      account_id: TENANT_A,
                      conversation_id: 'conv-1',
                      sender_type: 'customer',
                      content_type: 'text',
                      content_text: 'Recovered via fallback',
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                });
              }),
            };
          }
          return {};
        }),
      };

      const repo = new SupabaseConversationsRepository(
        { accountId: TENANT_A },
        customClient
      );

      const context = await repo.loadConversationContext('conv-1');
      expect(context.conversation).not.toBeNull();
      expect(context.messages.length).toBe(1);
      expect(context.messages[0].id).toBe('msg-fallback-1');
      expect(context.messages[0].content_text).toBe('Recovered via fallback');
    });
  });
});
