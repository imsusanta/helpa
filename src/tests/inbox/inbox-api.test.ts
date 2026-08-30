import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getCurrentAccount, mockSupabaseFrom, syncGroupNames } = vi.hoisted(
  () => ({
    getCurrentAccount: vi.fn(),
    mockSupabaseFrom: vi.fn(),
    syncGroupNames: vi.fn(async () => new Map<string, string>()),
  })
);

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount,
  UnauthorizedError: class UnauthorizedError extends Error {
    readonly status = 401 as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    readonly status = 403 as const;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

vi.mock('@/core/whatsapp/evolution-group-names', () => ({
  syncEvolutionGroupNamesForInbox: syncGroupNames,
}));

import { GET as getConversations } from '@/app/api/inbox/conversations/route';
import {
  GET as getConversation,
  PATCH as patchConversation,
} from '@/app/api/inbox/conversations/[id]/route';
import { GET as getMessages } from '@/app/api/inbox/conversations/[id]/messages/route';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/account';

function createRequest(
  url = 'http://localhost/api/inbox/conversations',
  method = 'GET',
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Inbox API & Tenant Isolation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncGroupNames.mockResolvedValue(new Map());
    getCurrentAccount.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-a',
      role: 'owner',
    });
  });

  describe('GET /api/inbox/conversations', () => {
    it('returns 401 when unauthenticated', async () => {
      getCurrentAccount.mockRejectedValue(new UnauthorizedError());
      const res = await getConversations(createRequest());
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/unauthorized/i);
    });

    it('returns 403 when user is not a member of any account', async () => {
      getCurrentAccount.mockRejectedValue(new ForbiddenError());
      const res = await getConversations(createRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/forbidden/i);
    });

    it('returns 200 with empty array for empty inbox', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabaseFrom.mockReturnValue(
        mockQuery as unknown as Record<string, unknown>
      );

      const res = await getConversations(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversations).toEqual([]);
      expect(json.total).toBe(0);
    });

    it('queries conversations strictly with authenticated accountId, ignoring forged query params', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'conv-1',
              account_id: 'tenant-a',
              contact_id: 'contact-1',
              status: 'open',
              last_message_text: 'Hello',
              last_message_at: '2026-08-14T00:00:00Z',
              unread_count: 2,
            },
          ],
          error: null,
        }),
      };

      const mockContactQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'contact-1',
              account_id: 'tenant-a',
              name: 'Alice',
              phone: '+1234567890',
            },
          ],
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'contacts')
          return mockContactQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getConversations(
        createRequest(
          'http://localhost/api/inbox/conversations?accountId=tenant-b'
        )
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversations).toHaveLength(1);
      expect(json.conversations[0].id).toBe('conv-1');
      expect(json.conversations[0].contact.name).toBe('Alice');

      expect(mockConvQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
    });

    it('labels WhatsApp group chats by name instead of the raw group id', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'conv-group',
              account_id: 'tenant-a',
              contact_id: 'contact-group',
              status: 'open',
              last_message_text: 'hello group',
            },
          ],
          error: null,
        }),
      };
      const mockContactQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'contact-group',
              account_id: 'tenant-a',
              name: '120363316746745895',
              phone: '120363316746745895',
            },
          ],
        }),
      };
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'contacts')
          return mockContactQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getConversations(createRequest());
      const json = await res.json();
      expect(json.conversations[0].contact.name).not.toBe('120363316746745895');
      expect(json.conversations[0].contact.name).not.toBe('WhatsApp group');
      expect(json.conversations[0].last_message_text).toBe('hello group');
    });

    it('uses the Evolution group subject as the inbox title', async () => {
      syncGroupNames.mockResolvedValueOnce(
        new Map([['120363316746745895', 'Helpa Clinic Team']])
      );
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'conv-group',
              account_id: 'tenant-a',
              contact_id: 'contact-group',
              status: 'open',
              last_message_text: 'hello group',
            },
          ],
          error: null,
        }),
      };
      const mockContactQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'contact-group',
              account_id: 'tenant-a',
              name: 'WhatsApp group',
              phone: '120363316746745895',
            },
          ],
        }),
      };
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'contacts')
          return mockContactQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getConversations(createRequest());
      const json = await res.json();
      expect(json.conversations[0].contact.name).toBe('Helpa Clinic Team');
    });
  });

  describe('GET /api/inbox/conversations/[id]', () => {
    it('returns 404 when conversation belongs to another tenant (Tenant B)', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseFrom.mockReturnValue(
        mockConvQuery as unknown as Record<string, unknown>
      );

      const res = await getConversation(
        createRequest('http://localhost/api/inbox/conversations/conv-tenant-b'),
        { params: Promise.resolve({ id: 'conv-tenant-b' }) }
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Conversation not found');
    });

    it('returns 200 when conversation belongs to authenticated tenant', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'conv-tenant-a',
            account_id: 'tenant-a',
            contact_id: 'contact-a',
            status: 'open',
            last_message_text: 'Test message',
            unread_count: 0,
          },
          error: null,
        }),
      };

      const mockContactQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'contact-a',
            account_id: 'tenant-a',
            name: 'Bob',
            phone: '+1987654321',
          },
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'contacts')
          return mockContactQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getConversation(
        createRequest('http://localhost/api/inbox/conversations/conv-tenant-a'),
        { params: Promise.resolve({ id: 'conv-tenant-a' }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversation.id).toBe('conv-tenant-a');
      expect(json.conversation.contact.name).toBe('Bob');
    });
  });

  describe('GET /api/inbox/conversations/[id]/messages', () => {
    it('returns 404 when requested conversation belongs to another tenant', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseFrom.mockReturnValue(
        mockConvQuery as unknown as Record<string, unknown>
      );

      const res = await getMessages(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-b/messages'
        ),
        { params: Promise.resolve({ id: 'conv-b' }) }
      );

      expect(res.status).toBe(404);
    });

    it('returns 200 with messages for valid tenant conversation', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'conv-a',
            account_id: 'tenant-a',
          },
          error: null,
        }),
      };

      const mockMsgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'msg-1',
              conversation_id: 'conv-a',
              sender_type: 'customer',
              content_type: 'text',
              content_text: 'Hi',
              status: 'delivered',
              created_at: '2026-08-14T00:00:00Z',
            },
          ],
          error: null,
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'messages')
          return mockMsgQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getMessages(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-a/messages'
        ),
        { params: Promise.resolve({ id: 'conv-a' }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.messages).toHaveLength(1);
      expect(json.messages[0].content_text).toBe('Hi');
      expect(json.messages[0].sender_type).toBe('customer');
      expect(mockMsgQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('returns the latest page in chronological order', async () => {
      const mockConvQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'conv-a', account_id: 'tenant-a' },
          error: null,
        }),
      };

      const mockMsgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'msg-2',
              conversation_id: 'conv-a',
              sender_type: 'agent',
              content_type: 'text',
              content_text: 'newest',
              status: 'sent',
              created_at: '2026-08-14T01:00:00Z',
            },
            {
              id: 'msg-1',
              conversation_id: 'conv-a',
              sender_type: 'customer',
              content_type: 'text',
              content_text: 'older',
              status: 'delivered',
              created_at: '2026-08-14T00:00:00Z',
            },
          ],
          error: null,
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        if (table === 'messages')
          return mockMsgQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await getMessages(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-a/messages'
        ),
        { params: Promise.resolve({ id: 'conv-a' }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(
        json.messages.map((m: { content_text: string }) => m.content_text)
      ).toEqual(['older', 'newest']);
    });
  });

  describe('PATCH /api/inbox/conversations/[id]', () => {
    it('rejects cross-tenant updates with 404', async () => {
      const mockConvQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseFrom.mockReturnValue(
        mockConvQuery as unknown as Record<string, unknown>
      );

      const res = await patchConversation(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-b',
          'PATCH',
          { status: 'closed' }
        ),
        { params: Promise.resolve({ id: 'conv-b' }) }
      );

      expect(res.status).toBe(404);
    });

    it('updates conversation status and unread count for matching tenant', async () => {
      const mockConvQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'conv-a',
            account_id: 'tenant-a',
            status: 'closed',
            unread_count: 0,
          },
          error: null,
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'conversations')
          return mockConvQuery as unknown as Record<string, unknown>;
        return {};
      });

      const res = await patchConversation(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-a',
          'PATCH',
          { status: 'closed', unread_count: 0 }
        ),
        { params: Promise.resolve({ id: 'conv-a' }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversation.status).toBe('closed');
      expect(json.conversation.unread_count).toBe(0);
    });
  });
});
