import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    verifyWebhook: vi.fn(),
    normalizeWebhook: vi.fn(),
    resolveWahaTenant: vi.fn(),
    persistInbound: vi.fn(),
    persistOutbound: vi.fn(),
    beginProviderEvent: vi.fn(),
    completeProviderEvent: vi.fn(),
    failProviderEvent: vi.fn(),
  },
}));

vi.mock('@/core/providers/whatsapp/waha-provider', () => ({
  WahaWhatsAppProvider: class {
    verifyWebhook = mocks.verifyWebhook;
    normalizeWebhook = mocks.normalizeWebhook;
  },
}));

vi.mock('@/app/api/webhooks/inbound-tenant-resolver', () => ({
  resolveWahaTenant: mocks.resolveWahaTenant,
}));

vi.mock('@/app/api/webhooks/inbound-persistence', () => ({
  persistNormalizedInboundMessage: mocks.persistInbound,
  persistNormalizedOutboundMessage: mocks.persistOutbound,
}));

vi.mock('@/app/api/webhooks/provider-event-log', () => ({
  beginProviderEvent: mocks.beginProviderEvent,
  completeProviderEvent: mocks.completeProviderEvent,
  failProviderEvent: mocks.failProviderEvent,
}));

import { POST } from './route';

function postRequest(body: unknown) {
  return new Request('https://helpa.test/api/webhooks/waha', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const TENANT = { accountId: 'acct-1', userId: 'user-1' };

function makeEvent(
  id: string,
  direction: 'inbound' | 'outbound' | string,
  overrides: Record<string, unknown> = {}
) {
  return {
    direction,
    externalMessageId: id,
    clinicId: '',
    patientAddress: '919999999999',
    recipientPhone: '919999999999',
    contentType: 'text',
    content: 'hello',
    channel: 'whatsapp',
    ...overrides,
  };
}

describe('POST /api/webhooks/waha — route behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyWebhook.mockResolvedValue(true);
    mocks.persistInbound.mockResolvedValue({
      duplicate: false,
      accountId: 'acct-1',
      contactId: 'c1',
      conversationId: 'conv1',
      messageId: 'm1',
    });
    mocks.persistOutbound.mockResolvedValue({
      duplicate: false,
      accountId: 'acct-1',
      contactId: 'c1',
      conversationId: 'conv1',
      messageId: 'm1',
    });
    mocks.beginProviderEvent.mockResolvedValue(undefined);
    mocks.completeProviderEvent.mockResolvedValue(undefined);
    mocks.failProviderEvent.mockResolvedValue(undefined);
  });

  it('returns 401 when the signature is invalid', async () => {
    mocks.verifyWebhook.mockResolvedValue(false);
    const res = await POST(postRequest({ event: 'message' }));
    expect(res.status).toBe(401);
    expect(mocks.normalizeWebhook).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON after a valid signature', async () => {
    const res = await POST(postRequest('not-json{'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON payload');
  });

  it('returns 403 when no server-side tenant maps the payload', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(null);
    const res = await POST(
      postRequest({ event: 'message', payload: { id: 'm1' } })
    );
    expect(res.status).toBe(403);
    expect(mocks.persistInbound).not.toHaveBeenCalled();
  });

  it('persists inbound events and reports counts', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockResolvedValue([makeEvent('e1', 'inbound')]);
    const res = await POST(
      postRequest({ event: 'message', payload: { id: 'm1' } })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      count: 1,
      persisted: 1,
      duplicates: 0,
    });
    expect(mocks.persistInbound).toHaveBeenCalledTimes(1);
    expect(mocks.persistOutbound).not.toHaveBeenCalled();
    expect(mocks.completeProviderEvent).toHaveBeenCalledTimes(1);
  });

  it('routes outbound events to the outbound persister', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockResolvedValue([makeEvent('e2', 'outbound')]);
    const res = await POST(postRequest({ event: 'message:individual' }));
    expect(res.status).toBe(200);
    expect(mocks.persistOutbound).toHaveBeenCalledTimes(1);
    expect(mocks.persistInbound).not.toHaveBeenCalled();
  });

  it('counts duplicates separately from persisted', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockResolvedValue([
      makeEvent('e1', 'inbound'),
      makeEvent('e2', 'inbound'),
    ]);
    mocks.persistInbound
      .mockResolvedValueOnce({ duplicate: true, accountId: 'acct-1' })
      .mockResolvedValueOnce({ duplicate: false, accountId: 'acct-1' });
    const res = await POST(postRequest({ event: 'message' }));
    const json = await res.json();
    expect(json.persisted).toBe(1);
    expect(json.duplicates).toBe(1);
  });

  it('skips events with unhandled direction', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockResolvedValue([makeEvent('e1', 'system')]);
    const res = await POST(postRequest({ event: 'message' }));
    const json = await res.json();
    expect(json.persisted).toBe(0);
    expect(mocks.persistInbound).not.toHaveBeenCalled();
  });

  it('returns 500 with error list when persistence fails', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockResolvedValue([makeEvent('e1', 'inbound')]);
    mocks.persistInbound.mockRejectedValue(new Error('db down'));
    const res = await POST(postRequest({ event: 'message' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.failed).toBe(1);
    expect(json.errors[0]).toContain('e1: db down');
    expect(mocks.failProviderEvent).toHaveBeenCalledTimes(1);
  });

  it('overwrites clinicId with the verified tenant before persisting', async () => {
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    let captured: { clinicId?: string } = {};
    mocks.persistInbound.mockImplementation(async (event: unknown) => {
      captured = event as { clinicId?: string };
      return { duplicate: false, accountId: 'acct-1' };
    });
    mocks.normalizeWebhook.mockResolvedValue([
      makeEvent('e1', 'inbound', { clinicId: 'spoofed' }),
    ]);
    await POST(postRequest({ event: 'message' }));
    expect(captured?.clinicId).toBe('acct-1');
  });

  it('returns 500 when an unexpected error escapes', async () => {
    mocks.verifyWebhook.mockResolvedValue(true);
    mocks.resolveWahaTenant.mockResolvedValue(TENANT);
    mocks.normalizeWebhook.mockRejectedValue(new Error('normalizer exploded'));
    const res = await POST(postRequest({ event: 'message' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Inbound webhook processing failed');
  });
});
