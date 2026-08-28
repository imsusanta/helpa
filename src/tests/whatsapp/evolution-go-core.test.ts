import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '@/lib/whatsapp/encryption';
import {
  classifyWhatsAppProvider,
  UnknownWhatsAppProviderError,
} from '@/core/whatsapp/canonical-config';
import { resolveWhatsAppProvider } from '@/core/providers/whatsapp/provider-resolver';
import {
  createEvolutionGoInstance,
  getEvolutionGoQr,
  sendEvolutionGoText,
  EvolutionGoConfigError,
  EvolutionGoRequestError,
  EVOLUTION_GO_WRONG_HOST_MESSAGE,
} from '@/core/providers/whatsapp/evolution-go-client';
import {
  EvolutionGoProvider,
  hashWebhookSecret,
  redactEvolutionWebhookPayload,
  webhookSecretMatches,
} from '@/core/providers/whatsapp/evolution-go-provider';
import { UnsupportedWhatsAppOperationError } from '@/core/providers/whatsapp/whatsapp-provider.interface';
import {
  getEvolutionGoBaseUrl,
  isWhatsAppQrSimulationAllowed,
  evolutionGoTimeoutMs,
  runWithEvolutionDeadline,
  VERCEL_EVOLUTION_REQUEST_TIMEOUT_MS,
} from '@/core/providers/whatsapp/evolution-go-env';
import * as canonical from '@/core/whatsapp/canonical-config';

describe('Evolution Go provider classification', () => {
  it('selects Meta for empty and existing Meta provider strings', () => {
    expect(classifyWhatsAppProvider(undefined)).toBe('meta');
    expect(classifyWhatsAppProvider('')).toBe('meta');
    expect(classifyWhatsAppProvider('meta')).toBe('meta');
    expect(classifyWhatsAppProvider('meta_embedded_signup')).toBe('meta');
    expect(classifyWhatsAppProvider('meta_manual_config')).toBe('meta');
  });

  it('selects Evolution for evolution provider values', () => {
    expect(classifyWhatsAppProvider('evolution')).toBe('evolution');
    expect(classifyWhatsAppProvider('evolution_go')).toBe('evolution');
  });

  it('keeps WAHA as legacy support', () => {
    expect(classifyWhatsAppProvider('waha')).toBe('waha');
  });

  it('fails closed for unknown providers', () => {
    expect(classifyWhatsAppProvider('twilio')).toBe('unknown');
    expect(classifyWhatsAppProvider('random-vendor')).toBe('unknown');
  });
});

describe('WhatsApp provider resolver', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves Meta without constructing an Evolution provider', async () => {
    vi.spyOn(canonical, 'requireCanonicalWhatsAppConfig').mockResolvedValue({
      id: 'cfg-meta',
      accountId: 'acct-meta',
      providerRaw: 'meta_embedded_signup',
      providerKind: 'meta',
      phoneNumberId: 'pnid',
      wabaId: 'waba',
      encryptedAccessToken: encrypt('meta-token'),
      providerInstanceId: '',
      providerInstanceName: '',
      providerTokenEncrypted: '',
      webhookSecretHash: '',
      status: 'connected',
      connectionStatus: 'connected',
      displayPhoneNumber: '15551234567',
      verifiedName: 'Clinic',
      connectionError: '',
      source: 'whatsapp_configs',
      raw: {},
    });
    const resolved = await resolveWhatsAppProvider('acct-meta');
    expect(resolved.kind).toBe('meta');
    expect(resolved.provider).toBeNull();
  });

  it('resolves Evolution with the decrypted instance token', async () => {
    const instanceToken = 'tenant-instance-token-aaaaaaaa';
    vi.spyOn(canonical, 'requireCanonicalWhatsAppConfig').mockResolvedValue({
      id: 'cfg-evo',
      accountId: 'acct-evo',
      providerRaw: 'evolution',
      providerKind: 'evolution',
      phoneNumberId: 'evolution:inst-1',
      wabaId: '',
      encryptedAccessToken: encrypt(instanceToken),
      providerInstanceId: 'inst-1',
      providerInstanceName: 'habc',
      providerTokenEncrypted: encrypt(instanceToken),
      webhookSecretHash: 'abc',
      status: 'connected',
      connectionStatus: 'connected',
      displayPhoneNumber: '919999999999',
      verifiedName: 'Linked',
      connectionError: '',
      source: 'whatsapp_configs',
      raw: {},
    });
    const resolved = await resolveWhatsAppProvider('acct-evo');
    expect(resolved.kind).toBe('evolution');
    expect(resolved.provider).toBeInstanceOf(EvolutionGoProvider);
  });

  it('throws for an unknown provider instead of defaulting to Meta', async () => {
    vi.spyOn(canonical, 'requireCanonicalWhatsAppConfig').mockImplementation(
      async () => {
        throw new UnknownWhatsAppProviderError('not-a-provider');
      }
    );
    await expect(resolveWhatsAppProvider('acct-x')).rejects.toBeInstanceOf(
      UnknownWhatsAppProviderError
    );
  });
});

describe('Evolution Go HTTP client', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.EVOLUTION_GO_BASE_URL = 'https://evolution.test';
    process.env.EVOLUTION_GO_GLOBAL_API_KEY = 'test-global-api-key';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('creates instances with the global apikey header', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { id: 'inst-1', name: 'hname', connected: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const created = await createEvolutionGoInstance({
      name: 'hname',
      token: 'instance-token-secret',
      instanceId: 'inst-1',
    });
    expect(created.id).toBe('inst-1');
    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    expect(new Headers(call[1]?.headers).get('apikey')).toBe(
      'test-global-api-key'
    );
    expect(String(call[1]?.body)).toContain('instance-token-secret');
    expect(String(call[0])).toBe('https://evolution.test/instance/create');
    expect(call[1]?.redirect).toBe('manual');
  });

  it('rejects login redirects and prevents secret forwarding to another page', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('/login', {
          status: 307,
          headers: { Location: '/login', 'Content-Type': 'text/plain' },
        })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      createEvolutionGoInstance({
        name: 'hname',
        token: 'instance-token-secret',
      })
    ).rejects.toMatchObject({
      name: 'EvolutionGoConfigError',
      message: EVOLUTION_GO_WRONG_HOST_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit)?.redirect).toBe(
      'manual'
    );
  });

  it('rejects a 200 Helpa HTML page as the wrong Evolution host', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<!DOCTYPE html><html><body>helpa</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    ) as unknown as typeof fetch;
    await expect(
      createEvolutionGoInstance({
        name: 'hname',
        token: 'instance-token-secret',
      })
    ).rejects.toBeInstanceOf(EvolutionGoConfigError);
  });

  it('accepts a successful image QR response', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(png, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        })
    ) as unknown as typeof fetch;
    const qr = await getEvolutionGoQr('tenant-instance-token');
    expect(qr.qrcode.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('surfaces a license error instead of a generic 502', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'LICENSE_REQUIRED',
            error: 'service not activated',
            message: 'License required.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
    ) as unknown as typeof fetch;
    await expect(
      createEvolutionGoInstance({
        name: 'hname',
        token: 'instance-token-secret',
      })
    ).rejects.toMatchObject({
      name: 'EvolutionGoConfigError',
      message: expect.stringMatching(/not licensed/i),
    });
  });

  it('sends text with the tenant instance token, not the global key', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { key: { id: 'wamid.evo.1' } } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await sendEvolutionGoText('tenant-instance-token', {
      number: '919876543210',
      text: 'hello',
    });
    expect(result.externalMessageId).toBe('wamid.evo.1');
    const sendCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    expect(new Headers(sendCall[1]?.headers).get('apikey')).toBe(
      'tenant-instance-token'
    );
    expect(String(sendCall[0])).toBe('https://evolution.test/send/text');
  });

  it('sanitizes remote errors and never returns secret values', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: 'unauthorized apikey=super-secret-global-key token=abc',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      createEvolutionGoInstance({ name: 'x', token: 'y' })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(EvolutionGoRequestError);
      const message = (error as Error).message;
      expect(message).toContain('Evolution Go request failed');
      expect(message).not.toContain('super-secret-global-key');
      expect(message).not.toContain('test-global-api-key');
      return true;
    });
  });
});

describe('Evolution Go provider behaviour', () => {
  it('rejects sendTemplate as an unsupported operation', async () => {
    const provider = new EvolutionGoProvider({
      accountId: 'acct-1',
      instanceToken: 'tok',
    });
    await expect(
      provider.sendTemplate('acct-1', '919999999999', 'hello_world', 'en_US')
    ).rejects.toBeInstanceOf(UnsupportedWhatsAppOperationError);
  });

  it('normalizes an inbound message to the owning account', async () => {
    const provider = new EvolutionGoProvider({
      accountId: 'tenant-a',
      instanceToken: '',
    });
    const events = await provider.normalizeWebhook({
      event: 'Message',
      data: {
        key: {
          id: 'msg-1',
          fromMe: false,
          remoteJid: '919888777666@s.whatsapp.net',
        },
        message: { conversation: 'hello clinic' },
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].clinicId).toBe('tenant-a');
    expect(events[0].direction).toBe('inbound');
    expect(events[0].content).toBe('hello clinic');
  });

  it('does not emit inbound direction for fromMe messages', async () => {
    const provider = new EvolutionGoProvider({
      accountId: 'tenant-a',
      instanceToken: '',
    });
    const events = await provider.normalizeWebhook({
      event: 'Message',
      data: {
        key: {
          id: 'msg-out',
          fromMe: true,
          remoteJid: '919888777666@s.whatsapp.net',
        },
        message: { conversation: 'sent by clinic' },
      },
    });
    expect(events[0].direction).toBe('outbound');
  });

  it('compares webhook secrets in a timing-safe way', () => {
    const secret = 'high-entropy-url-secret';
    const hash = hashWebhookSecret(secret);
    expect(webhookSecretMatches(secret, hash)).toBe(true);
    expect(webhookSecretMatches('other-secret', hash)).toBe(false);
    expect(hash).not.toBe(secret);
  });

  it('redacts nested webhook secrets without remote property assignment', () => {
    const payload = {
      event: 'Message',
      instanceToken: 'top-secret',
      apikey: 'global-key',
      data: { token: 'nested-token', key: { id: 'msg-1', fromMe: false } },
    };
    const redacted = redactEvolutionWebhookPayload(payload);
    expect(redacted.event).toBe('Message');
    expect(redacted).not.toHaveProperty('instanceToken');
    expect(redacted).not.toHaveProperty('apikey');
    const data = redacted.data as Record<string, unknown>;
    expect(data).not.toHaveProperty('token');
    expect(data.key).toEqual({ id: 'msg-1', fromMe: false });
  });
});

describe('Evolution Go env guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.EVOLUTION_GO_BASE_URL = 'https://evolution.test';
    delete process.env.ALLOW_WHATSAPP_QR_SIMULATION;
    delete process.env.EVOLUTION_GO_TIMEOUT_MS;
    delete process.env.EVOLUTION_GO_SESSION_BUDGET_MS;
  });

  it('requires HTTPS base URLs in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.EVOLUTION_GO_BASE_URL = 'http://evolution.internal';
    expect(() => getEvolutionGoBaseUrl()).toThrow(/HTTPS/);
  });
  it('forbids QR simulation in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.ALLOW_WHATSAPP_QR_SIMULATION = 'true';
    expect(isWhatsAppQrSimulationAllowed()).toBe(false);
  });
  it('caps per-request timeout on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    delete process.env.EVOLUTION_GO_TIMEOUT_MS;
    expect(evolutionGoTimeoutMs()).toBe(VERCEL_EVOLUTION_REQUEST_TIMEOUT_MS);
  });
  it('shortens in-flight requests to the remaining session budget', async () => {
    process.env.EVOLUTION_GO_SESSION_BUDGET_MS = '3000';
    process.env.EVOLUTION_GO_TIMEOUT_MS = '30000';
    await runWithEvolutionDeadline(async () => {
      expect(evolutionGoTimeoutMs()).toBeLessThanOrEqual(3000);
    });
  });
});
