import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    resolveEvolutionGoTenant: vi.fn(),
    persistInbound: vi.fn(),
    persistOutbound: vi.fn(),
    beginProviderEvent: vi.fn(),
    completeProviderEvent: vi.fn(),
    failProviderEvent: vi.fn(),
    normalizeWebhook: vi.fn(),
    triggerAiResponse: vi.fn(),
    dispatchFollowup: vi.fn(),
    dbFrom: vi.fn(),
    applyGroupName: vi.fn(),
    resolveGroupName: vi.fn(),
    scheduleRefresh: vi.fn(),
  },
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({ from: mocks.dbFrom }),
}));

vi.mock('@/app/api/webhooks/inbound-persistence', () => ({
  persistNormalizedInboundMessage: mocks.persistInbound,
  persistNormalizedOutboundMessage: mocks.persistOutbound,
}));

vi.mock('@/app/api/webhooks/inbound-tenant-resolver', () => ({
  resolveEvolutionGoTenant: mocks.resolveEvolutionGoTenant,
}));

vi.mock('@/app/api/webhooks/provider-event-log', () => ({
  beginProviderEvent: mocks.beginProviderEvent,
  completeProviderEvent: mocks.completeProviderEvent,
  failProviderEvent: mocks.failProviderEvent,
}));

vi.mock('@/core/providers/whatsapp/evolution-go-provider', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    EvolutionGoProvider: class {
      normalizeWebhook = mocks.normalizeWebhook;
    },
  };
});

vi.mock('@/lib/whatsapp/ai', () => ({
  triggerAiResponse: mocks.triggerAiResponse,
}));

vi.mock('@/lib/whatsapp/evolution-inbound-followup', () => ({
  dispatchEvolutionInboundFollowup: mocks.dispatchFollowup,
}));

vi.mock('@/core/whatsapp/evolution-group-names', () => ({
  applyEvolutionGroupNameEvent: mocks.applyGroupName,
  resolveEvolutionGroupName: mocks.resolveGroupName,
  scheduleEvolutionGroupNameRefresh: mocks.scheduleRefresh,
}));

import { POST } from './route';

const TENANT = { accountId: 'acct-1', userId: 'user-1' };

function call(
  secret: string,
  body: unknown,
  extraHeaders: Record<string, string> = {}
) {
  return new Request(`https://helpa.test/api/webhooks/evolution/${secret}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as Request & { params?: unknown };
}

async function post(secret: string, body: unknown) {
  const req = call(secret, body);
  // Next.js route handler signature: (request, { params })
  return POST(req, { params: Promise.resolve({ secret }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbFrom.mockImplementation(() => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    q.update = vi.fn(() => chain());
    q.eq = vi.fn(() => chain());
    (q as { then?: unknown }).then = undefined;
    return {
      update: q.update,
      eq: q.eq,
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
      ...q,
    };
  });
  mocks.resolveEvolutionGoTenant.mockResolvedValue(TENANT);
  mocks.normalizeWebhook.mockResolvedValue([]);
  mocks.persistInbound.mockResolvedValue({
    duplicate: false,
    accountId: 'acct-1',
    contactId: 'c1',
    conversationId: 'conv1',
    messageId: 'm1',
  });
  mocks.beginProviderEvent.mockResolvedValue({ duplicate: false });
  mocks.completeProviderEvent.mockResolvedValue(undefined);
  mocks.failProviderEvent.mockResolvedValue(undefined);
  mocks.dispatchFollowup.mockResolvedValue({ handled: false });
  mocks.triggerAiResponse.mockResolvedValue(undefined);
});

describe('POST /api/webhooks/evolution/[secret]', () => {
  it('returns 403 when the secret does not map to a tenant', async () => {
    mocks.resolveEvolutionGoTenant.mockResolvedValue(null);
    const res = await post('wrong-secret', { event: 'x' });
    expect(res.status).toBe(403);
    expect(mocks.normalizeWebhook).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await post('good-secret', 'not-json{');
    expect(res.status).toBe(400);
  });

  it('strips spoofed tenant fields before processing', async () => {
    let captured: Record<string, unknown> | null = null;
    mocks.normalizeWebhook.mockImplementation(async (payload) => {
      captured = payload;
      return [];
    });
    await post('good-secret', {
      event: 'messages.upsert',
      account_id: 'spoofed',
      tenantId: 'also-spoofed',
      data: {},
    });
    expect(captured).not.toBeNull();
    expect(captured?.account_id).toBeUndefined();
    expect(captured?.tenantId).toBeUndefined();
  });

  it('handles connection events and marks duplicates', async () => {
    const body = { event: 'connected', data: { jid: '91999@s.whatsapp.net' } };
    const res1 = await post('good-secret', body);
    const json1 = await res1.json();
    expect(json1.type).toBe('connection');
    expect(json1.success).toBe(true);

    mocks.beginProviderEvent.mockResolvedValue({ duplicate: true });
    const res2 = await post('good-secret', body);
    const json2 = await res2.json();
    expect(json2.duplicate).toBe(true);
  });

  it('handles receipt events', async () => {
    const res = await post('good-secret', {
      event: 'receipt',
      data: {},
    });
    const json = await res.json();
    expect(json.type).toBe('receipt');
  });

  it('handles group events', async () => {
    const res = await post('good-secret', {
      event: 'group',
      data: {},
    });
    const json = await res.json();
    expect(json.type).toBe('group');
  });

  it('persists inbound messages and reports counts', async () => {
    mocks.normalizeWebhook.mockResolvedValue([
      {
        direction: 'inbound',
        externalMessageId: 'e1',
        patientAddress: '919999999999',
        contentType: 'text',
        content: 'hello',
        channel: 'whatsapp',
      },
    ]);
    const res = await post('good-secret', {
      event: 'messages.upsert',
      data: {},
    });
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      count: 1,
      persisted: 1,
      duplicates: 0,
    });
    expect(mocks.persistInbound).toHaveBeenCalledTimes(1);
  });

  it('routes outbound to the outbound persister', async () => {
    mocks.normalizeWebhook.mockResolvedValue([
      {
        direction: 'outbound',
        externalMessageId: 'e2',
        recipientPhone: '919999999999',
        contentType: 'text',
        content: 'sent from phone',
        channel: 'whatsapp',
      },
    ]);
    await post('good-secret', { event: 'send.message' });
    expect(mocks.persistOutbound).toHaveBeenCalledTimes(1);
    expect(mocks.persistInbound).not.toHaveBeenCalled();
  });

  it('returns 500 with failures when persistence throws', async () => {
    mocks.normalizeWebhook.mockResolvedValue([
      {
        direction: 'inbound',
        externalMessageId: 'e1',
        patientAddress: '919999999999',
        contentType: 'text',
        content: 'x',
        channel: 'whatsapp',
      },
    ]);
    mocks.persistInbound.mockRejectedValue(new Error('db down'));
    const res = await post('good-secret', { event: 'messages.upsert' });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.failed).toBe(1);
  });

  it('triggers AI only for inbound non-duplicate persists', async () => {
    mocks.normalizeWebhook.mockResolvedValue([
      {
        direction: 'inbound',
        externalMessageId: 'e1',
        patientAddress: '919999999999',
        contentType: 'text',
        content: 'hi',
        channel: 'whatsapp',
      },
    ]);
    await post('good-secret', { event: 'messages.upsert' });
    expect(mocks.triggerAiResponse).toHaveBeenCalledTimes(1);
  });

  it('does not trigger AI for outbound', async () => {
    mocks.normalizeWebhook.mockResolvedValue([
      {
        direction: 'outbound',
        externalMessageId: 'e2',
        recipientPhone: '919999999999',
        contentType: 'text',
        content: 'x',
        channel: 'whatsapp',
      },
    ]);
    await post('good-secret', { event: 'send.message' });
    expect(mocks.triggerAiResponse).not.toHaveBeenCalled();
  });
});
