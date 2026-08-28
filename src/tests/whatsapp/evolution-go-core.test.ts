import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '@/lib/whatsapp/encryption';
import {
  classifyWhatsAppProvider,
  UnknownWhatsAppProviderError,
} from '@/core/whatsapp/canonical-config';
import { resolveWhatsAppProvider } from '@/core/providers/whatsapp/provider-resolver';
import {
  createEvolutionGoInstance,
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
import {
  getEvolutionGoBaseUrl,
  isWhatsAppQrSimulationAllowed,
  evolutionGoTimeoutMs,
  runWithEvolutionDeadline,
  hasEnoughEvolutionDeadline,
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
    const firstCall = fetchMock.mock.calls[0] as unknown as
      [RequestInfo | URL, RequestInit | undefined] | undefined;
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBe('https://evolution.test/instance/create');
    const init = firstCall?.[1];
    expect(init).toBeDefined();
    expect(new Headers(init?.headers).get('apikey')).toBe(
      'test-global-api-key'
    );
    expect(String(init?.body)).toContain('instance-token-secret');
    expect(init?.redirect).toBe('manual');
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
    const firstCall = fetchMock.mock.calls[0] as unknown as
      [RequestInfo | URL, RequestInit | undefined] | undefined;
    expect(firstCall?.[1]?.redirect).toBe('manual');
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
    const firstCall = fetchMock.mock.calls[0] as unknown as
      [RequestInfo | URL, RequestInit | undefined] | undefined;
    expect(firstCall?.[0]).toBe('https://evolution.test/send/text');
    expect(new Headers(firstCall?.[1]?.headers).get('apikey')).toBe(
      'tenant-instance-token'
    );
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
      return true;
    });
  });
});

describe('Evolution Go provider helpers', () => {
  it('hashes and matches webhook secrets', async () => {
    const secret = 'webhook-secret';
    const hash = await hashWebhookSecret(secret);
    expect(await webhookSecretMatches(secret, hash)).toBe(true);
    expect(await webhookSecretMatches('wrong-secret', hash)).toBe(false);
  });

  it('redacts webhook payloads', () => {
    const input = {
      data: {
        apikey: 'secret-key',
        token: 'secret-token',
        text: 'hello',
      },
      sender: '123',
    };
    const redacted = redactEvolutionWebhookPayload(input);
    expect(JSON.stringify(redacted)).not.toContain('secret-key');
    expect(JSON.stringify(redacted)).not.toContain('secret-token');
    expect(redacted.sender).toBe('123');
  });

  it('throws unsupported operations for commands not implemented by Evolution Go', async () => {
    const provider = new EvolutionGoProvider({
      accountId: 'acc-1',
      instanceToken: 'tenant-instance-token',
    });
    await expect(
      provider.sendTemplate('123', 'test_template', 'en')
    ).rejects.toThrow();
  });
});

describe('Evolution Go environment helpers', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads a normalized base URL', () => {
    vi.stubEnv('EVOLUTION_GO_BASE_URL', 'https://evolution.example///');
    expect(getEvolutionGoBaseUrl()).toBe('https://evolution.example');
  });

  it('disables QR simulation outside explicit test mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('EVOLUTION_GO_ALLOW_QR_SIMULATION', 'true');
    expect(isWhatsAppQrSimulationAllowed()).toBe(false);
  });

  it('uses the Vercel timeout ceiling', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('EVOLUTION_GO_TIMEOUT_MS', '60000');
    expect(evolutionGoTimeoutMs()).toBeLessThanOrEqual(
      VERCEL_EVOLUTION_REQUEST_TIMEOUT_MS
    );
  });

  it('bounds a request by the Evolution Go deadline', async () => {
    vi.stubEnv('EVOLUTION_GO_SESSION_BUDGET_MS', '5000');
    const withinBudget = await runWithEvolutionDeadline(async () => {
      return hasEnoughEvolutionDeadline(2000);
    });
    expect(withinBudget).toBe(true);
  });
});
