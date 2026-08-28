import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '@/lib/whatsapp/encryption';

const mocks = vi.hoisted(() => ({
  persistOutboundMessage: vi.fn(),
  touchConversationPreview: vi.fn(),
  pauseActiveFlowRuns: vi.fn(),
  outboundPreviewText: vi.fn(
    ({ contentText }: { contentText?: string | null }) => contentText || ''
  ),
  createPreSendOutbox: vi.fn(),
  markSent: vi.fn(),
  markDeadLetter: vi.fn(),
  markReconciliationRequired: vi.fn(),
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  config: {
    id: 'cfg-1',
    account_id: 'tenant-1',
    phone_number_id: 'pnid-1',
    encrypted_access_token: '',
    status: 'connected',
    provider: undefined as string | undefined,
    provider_token_encrypted: undefined as string | undefined,
  },
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

vi.mock('@/lib/whatsapp/encryption', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/whatsapp/encryption')>();
  return {
    ...actual,
    isLegacyFormat: () => false,
  };
});

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTextMessage: mocks.sendTextMessage,
  sendTemplateMessage: mocks.sendTemplateMessage,
  sendMediaMessage: mocks.sendMediaMessage,
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
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: () => builder,
      maybeSingle: async () => {
        if (table === 'whatsapp_configs') {
          return { data: { ...mocks.config }, error: null };
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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 10,
    reset: Date.now() + 1000,
    limit: 20,
  }),
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: {
    send: { limit: 20, windowMs: 10_000 },
    adminAction: { limit: 20, windowMs: 10_000 },
  },
}));

import { POST } from '@/app/api/whatsapp/send/route';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('WhatsApp outbound provider dispatch', () => {
  const originalFetch = globalThis.fetch;
  let evoHeaders: string[] = [];

  beforeEach(() => {
    evoHeaders = [];
    vi.clearAllMocks();
    mocks.config.provider = undefined;
    mocks.config.phone_number_id = 'pnid-1';
    mocks.config.encrypted_access_token = encrypt('meta-access-token');
    mocks.config.provider_token_encrypted = undefined;
    mocks.createPreSendOutbox.mockResolvedValue({
      ok: true,
      status: 'created',
      outboxId: 'outbox-1',
      requestHashMatches: true,
    });
    mocks.sendTextMessage.mockResolvedValue({ messageId: 'wamid.META.1' });
    mocks.persistOutboundMessage.mockResolvedValue({
      ok: true,
      messageId: 'msg-local-1',
      duplicate: false,
    });
    mocks.touchConversationPreview.mockResolvedValue(undefined);
    mocks.pauseActiveFlowRuns.mockResolvedValue(undefined);
    mocks.markSent.mockResolvedValue(undefined);
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const apikey = new Headers(init?.headers).get('apikey') || '';
        evoHeaders.push(apikey);
        if (url.includes('/send/text')) {
          return new Response(
            JSON.stringify({ data: { key: { id: 'wamid.EVO.1' } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('not found', { status: 404 });
      }
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('keeps the Meta outbound path when provider is omitted', async () => {
    const res = await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'text',
        content_text: 'Hello from clinic',
      })
    );
    expect(res.status).toBe(200);
    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(evoHeaders).toHaveLength(0);
  });

  it('sends Evolution outbound text with the instance token', async () => {
    const instanceToken = 'evo-instance-token-xyz';
    mocks.config.provider = 'evolution';
    mocks.config.phone_number_id = 'evolution:inst-1';
    mocks.config.encrypted_access_token = encrypt(instanceToken);
    mocks.config.provider_token_encrypted = encrypt(instanceToken);

    const res = await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'text',
        content_text: 'Hello over Evolution',
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message_id).toBe('wamid.EVO.1');
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(evoHeaders).toEqual([instanceToken]);
    expect(mocks.createPreSendOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'evolution' })
    );
  });

  it('does not send templates through Meta for an Evolution workspace', async () => {
    const instanceToken = 'evo-instance-token-xyz';
    mocks.config.provider = 'evolution';
    mocks.config.phone_number_id = 'evolution:inst-1';
    mocks.config.encrypted_access_token = encrypt(instanceToken);
    mocks.config.provider_token_encrypted = encrypt(instanceToken);

    const res = await POST(
      makeRequest({
        conversation_id: 'conv-1',
        message_type: 'template',
        template_name: 'hello_world',
        content_text: '',
      })
    );
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toMatch(/templates are not available/i);
    expect(mocks.sendTemplateMessage).not.toHaveBeenCalled();
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });
});
