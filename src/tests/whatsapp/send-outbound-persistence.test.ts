import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistOutboundMessage: vi.fn(),
  touchConversationPreview: vi.fn(),
  pauseActiveFlowRuns: vi.fn(),
  outboundPreviewText: vi.fn(
    ({
      contentText,
      contentType,
    }: {
      contentText?: string | null;
      contentType: string;
    }) => contentText || `[${contentType}]`
  ),
  createPreSendOutbox: vi.fn(),
  markSent: vi.fn(),
  markDeadLetter: vi.fn(),
  markReconciliationRequired: vi.fn(),
  sendTextMessage: vi.fn(),
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

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: (value: string) => value,
  encrypt: (value: string) => value,
  isLegacyFormat: () => false,
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTextMessage: mocks.sendTextMessage,
  sendTemplateMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
}));

vi.mock('@/lib/whatsapp/outbox-service', () => ({
  OutboxService: {
    createPreSendOutbox: mocks.createPreSendOutbox,
    markSent: mocks.markSent,
    markDeadLetter: mocks.markDeadLetter,
    markReconciliationRequired: mocks.markReconciliationRequired,
  },
}));

vi.mock('@/lib/whatsapp/persist-outbound-message', () => ({
  persistOutboundMessage: mocks.persistOutboundMessage,
  touchConversationPreview: mocks.touchConversationPreview,
  pauseActiveFlowRuns: mocks.pauseActiveFlowRuns,
  outboundPreviewText: mocks.outboundPreviewText,
}));

vi.mock('@/lib/db/server', () => {
  function makeBuilder(table: string) {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      maybeSingle: async () => {
        if (table === 'whatsapp_configs') {
          return {
            data: {
              id: 'cfg-1',
              account_id: 'tenant-1',
              phone_number_id: 'pnid-1',
              encrypted_access_token: 'token',
              status: 'connected',
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === 'conversations') {
          return {
            data: {
              id: 'conv-1',
              account_id: 'tenant-1',
              contact_id: 'cnt-1',
              contact: { id: 'cnt-1', phone: '+919876543210' },
            },
            error: null,
          };
        }
        return { data: null, error: { message: 'not found' } };
      },
    };
    return builder;
  }

  return {
    getAdminClient: () => ({ from: (table: string) => makeBuilder(table) }),
    createClient: async () => ({ from: (table: string) => makeBuilder(table) }),
  };
});

import { POST } from '@/app/api/whatsapp/send/route';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('WhatsApp send — inbox persistence after Meta accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPreSendOutbox.mockResolvedValue({
      ok: true,
      status: 'created',
      outboxId: 'outbox-1',
      requestHashMatches: true,
    });
    mocks.sendTextMessage.mockResolvedValue({ messageId: 'wamid.OUT.1' });
    mocks.persistOutboundMessage.mockResolvedValue({
      ok: true,
      messageId: 'msg-local-1',
      duplicate: false,
    });
    mocks.touchConversationPreview.mockResolvedValue(undefined);
    mocks.pauseActiveFlowRuns.mockResolvedValue(undefined);
    mocks.markSent.mockResolvedValue(undefined);
    mocks.markReconciliationRequired.mockResolvedValue(undefined);
  });

  it('persists the outbound row and returns the local inbox id', async () => {
    const res = await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'text',
        content_text: 'Hello from clinic',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      message_id: 'wamid.OUT.1',
      id: 'msg-local-1',
      conversation_id: 'conv-1',
    });

    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(mocks.persistOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'tenant-1',
        conversationId: 'conv-1',
        contentType: 'text',
        contentText: 'Hello from clinic',
        providerMessageId: 'wamid.OUT.1',
        senderId: 'user-1',
      })
    );
    expect(mocks.touchConversationPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'tenant-1',
        conversationId: 'conv-1',
        previewText: 'Hello from clinic',
      })
    );
    expect(mocks.pauseActiveFlowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'tenant-1',
        contactId: 'cnt-1',
      })
    );
    expect(mocks.markSent).toHaveBeenCalledWith(
      'outbox-1',
      'tenant-1',
      'wamid.OUT.1'
    );
    expect(mocks.markReconciliationRequired).not.toHaveBeenCalled();
  });

  it('does not mark the outbox sent if local persist fails; schedules reconcile instead', async () => {
    mocks.persistOutboundMessage.mockResolvedValue({
      ok: false,
      error: 'insert failed',
    });

    const res = await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'text',
        content_text: 'Hello from clinic',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('sent_meta_reconciliation_pending');
    expect(json.message_id).toBe('wamid.OUT.1');
    expect(json.id).toBeUndefined();
    expect(mocks.markSent).not.toHaveBeenCalled();
    expect(mocks.markReconciliationRequired).toHaveBeenCalledWith(
      'outbox-1',
      'tenant-1',
      'wamid.OUT.1',
      'insert failed'
    );
    expect(mocks.touchConversationPreview).not.toHaveBeenCalled();
  });

  it('stores a message snapshot on the outbox so reconcile can rebuild the bubble', async () => {
    await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'text',
        content_text: 'Hello from clinic',
      })
    );

    expect(mocks.createPreSendOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'tenant-1',
        conversationId: 'conv-1',
        messageType: 'text',
        messageSnapshot: expect.objectContaining({
          contentType: 'text',
          contentText: 'Hello from clinic',
          senderId: 'user-1',
        }),
      })
    );
  });
});
