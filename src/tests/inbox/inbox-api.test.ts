import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getCurrentAccount,
  mockListDocuments,
  mockGetDocument,
  mockUpdateDocument,
} = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  mockListDocuments: vi.fn(),
  mockGetDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount,
  UnauthorizedError: class UnauthorizedError extends Error {
    readonly status = 401 as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    readonly status = 403 as const;
  },
}));

vi.mock('@/infrastructure/appwrite/server', () => ({
  getAppwriteAdminClient: () => ({
    databases: {
      listDocuments: mockListDocuments,
      getDocument: mockGetDocument,
      updateDocument: mockUpdateDocument,
    },
  }),
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
      mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });
      const res = await getConversations(createRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversations).toEqual([]);
      expect(json.total).toBe(0);
    });

    it('queries conversations strictly with authenticated accountId, ignoring forged query params', async () => {
      mockListDocuments
        .mockResolvedValueOnce({
          documents: [
            {
              $id: 'conv-1',
              accountId: 'tenant-a',
              contactId: 'contact-1',
              status: 'open',
              lastMessageText: 'Hello',
              lastMessageAt: '2026-08-14T00:00:00Z',
              unreadCount: 2,
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          documents: [
            {
              $id: 'contact-1',
              accountId: 'tenant-a',
              name: 'Alice',
              phone: '+1234567890',
            },
          ],
          total: 1,
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

      // Verify server queried using tenant-a
      const callArgs = mockListDocuments.mock.calls[0];
      const queryList = callArgs[2];
      expect(
        queryList.some(
          (q: string) => q.includes('accountId') && q.includes('tenant-a')
        )
      ).toBe(true);
      expect(
        queryList.some(
          (q: string) => q.includes('accountId') && q.includes('tenant-b')
        )
      ).toBe(false);
    });
  });

  describe('GET /api/inbox/conversations/[id]', () => {
    it('returns 404 when conversation belongs to another tenant (Tenant B)', async () => {
      mockGetDocument.mockResolvedValueOnce({
        $id: 'conv-tenant-b',
        accountId: 'tenant-b',
        contactId: 'contact-b',
      });

      const res = await getConversation(
        createRequest('http://localhost/api/inbox/conversations/conv-tenant-b'),
        { params: Promise.resolve({ id: 'conv-tenant-b' }) }
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Conversation not found');
    });

    it('returns 200 when conversation belongs to authenticated tenant', async () => {
      mockGetDocument
        .mockResolvedValueOnce({
          $id: 'conv-tenant-a',
          accountId: 'tenant-a',
          contactId: 'contact-a',
          status: 'open',
          lastMessageText: 'Test message',
          unreadCount: 0,
        })
        .mockResolvedValueOnce({
          $id: 'contact-a',
          accountId: 'tenant-a',
          name: 'Bob',
          phone: '+1987654321',
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
      mockGetDocument.mockResolvedValueOnce({
        $id: 'conv-b',
        accountId: 'tenant-b',
      });

      const res = await getMessages(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-b/messages'
        ),
        { params: Promise.resolve({ id: 'conv-b' }) }
      );

      expect(res.status).toBe(404);
      expect(mockListDocuments).not.toHaveBeenCalled();
    });

    it('returns 200 with messages for valid tenant conversation', async () => {
      mockGetDocument.mockResolvedValueOnce({
        $id: 'conv-a',
        accountId: 'tenant-a',
      });
      mockListDocuments.mockResolvedValueOnce({
        documents: [
          {
            $id: 'msg-1',
            conversationId: 'conv-a',
            senderType: 'customer',
            contentType: 'text',
            contentText: 'Hi',
            status: 'delivered',
            createdAt: '2026-08-14T00:00:00Z',
          },
        ],
        total: 1,
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
    });
  });

  describe('PATCH /api/inbox/conversations/[id]', () => {
    it('rejects cross-tenant updates with 404', async () => {
      mockGetDocument.mockResolvedValueOnce({
        $id: 'conv-b',
        accountId: 'tenant-b',
      });

      const res = await patchConversation(
        createRequest(
          'http://localhost/api/inbox/conversations/conv-b',
          'PATCH',
          { status: 'closed' }
        ),
        { params: Promise.resolve({ id: 'conv-b' }) }
      );

      expect(res.status).toBe(404);
      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });

    it('updates conversation status and unread count for matching tenant', async () => {
      mockGetDocument.mockResolvedValueOnce({
        $id: 'conv-a',
        accountId: 'tenant-a',
      });
      mockUpdateDocument.mockResolvedValueOnce({
        $id: 'conv-a',
        accountId: 'tenant-a',
        status: 'closed',
        unreadCount: 0,
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
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'conv-a',
        expect.objectContaining({ status: 'closed', unreadCount: 0 })
      );
    });
  });
});
