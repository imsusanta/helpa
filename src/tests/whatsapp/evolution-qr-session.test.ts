import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '@/lib/whatsapp/encryption';
import * as authAccount from '@/lib/auth/account';
import * as supabaseServer from '@/lib/supabase/server';
import * as dbServer from '@/lib/db/server';
import { hashWebhookSecret } from '@/core/providers/whatsapp/evolution-go-provider';
import { __resetRateLimitForTests } from '@/lib/rate-limit';
import {
  GET as qrGet,
  POST as qrPost,
  DELETE as qrDelete,
} from '@/app/api/whatsapp/qr/session/route';

type Row = Record<string, unknown>;

function makeAdminClient(db: Record<string, Row[]>) {
  return {
    from(table: string) {
      if (!db[table]) db[table] = [];
      const store = db[table];
      const state: {
        filters: Array<[string, unknown]>;
        mode: 'select' | 'insert' | 'update' | 'delete';
        patch: Row | null;
        inserted: Row | null;
        limit: number;
      } = {
        filters: [],
        mode: 'select',
        patch: null,
        inserted: null,
        limit: Number.POSITIVE_INFINITY,
      };
      const matched = () =>
        store.filter((row) =>
          state.filters.every(([key, value]) => row[key] === value)
        );
      const result = () => {
        if (state.mode === 'update' && state.patch) {
          const rows = matched();
          rows.forEach((row) => Object.assign(row, state.patch));
          return { data: rows, error: null };
        }
        if (state.mode === 'delete') {
          const remaining = store.filter(
            (row) => !state.filters.every(([key, value]) => row[key] === value)
          );
          db[table].length = 0;
          remaining.forEach((row) => db[table].push(row));
          return { data: [], error: null };
        }
        if (state.mode === 'insert') {
          return { data: state.inserted, error: null };
        }
        return { data: matched().slice(0, state.limit), error: null };
      };
      const builder: Record<string, unknown> = {
        select: () => {
          state.mode = 'select';
          return builder;
        },
        insert: (row: Row) => {
          const stored = {
            id: String(row.id || `id-${store.length + 1}`),
            ...row,
          };
          store.push(stored);
          state.mode = 'insert';
          state.inserted = stored;
          return builder;
        },
        update: (patch: Row) => {
          state.mode = 'update';
          state.patch = patch;
          return builder;
        },
        delete: () => {
          state.mode = 'delete';
          return builder;
        },
        eq: (key: string, value: unknown) => {
          state.filters.push([key, value]);
          return builder;
        },
        order: () => builder,
        limit: (count: number) => {
          state.limit = count;
          return builder;
        },
        maybeSingle: async () => {
          const { data } = result();
          const rows = Array.isArray(data) ? data : [];
          return { data: rows[0] || null, error: null };
        },
        then: (
          resolve: (value: { data: unknown; error: null }) => void,
          reject?: (reason: unknown) => void
        ) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
  };
}

function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/whatsapp/qr/session', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Evolution Go QR session route', () => {
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const originalFetch = globalThis.fetch;
  let db: Record<string, Row[]>;
  let evoCalls: Array<{
    path: string;
    method: string;
    apikey: string;
    body: unknown;
  }>;
  let loggedIn = false;
  let createCount = 0;

  beforeEach(() => {
    __resetRateLimitForTests();
    db = {
      whatsapp_configs: [],
      accounts: [{ id: tenantA }, { id: tenantB }],
      account_members: [
        { account_id: tenantA, user_id: 'user-a', role: 'admin' },
        { account_id: tenantB, user_id: 'user-b', role: 'admin' },
      ],
      messages: [
        {
          id: 'msg-keep',
          account_id: tenantA,
          content_text: 'history',
        },
      ],
    };
    evoCalls = [];
    loggedIn = false;
    createCount = 0;
    process.env.EVOLUTION_GO_BASE_URL = 'https://evolution.test';
    process.env.EVOLUTION_GO_GLOBAL_API_KEY = 'test-global-api-key';
    process.env.EVOLUTION_GO_WEBHOOK_BASE_URL = 'https://helpa.test';

    const client = makeAdminClient(db);
    vi.spyOn(supabaseServer, 'getAdminClient').mockReturnValue(client as never);
    vi.spyOn(dbServer, 'getAdminClient').mockReturnValue(client as never);
    vi.spyOn(authAccount, 'requireRole').mockResolvedValue({
      userId: 'user-a',
      accountId: tenantA,
      role: 'admin',
      account: { id: tenantA, name: 'A' } as never,
      admin: {},
      appwrite: {},
    } as never);

    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const parsed = new URL(url);
        const method = String(init?.method || 'GET').toUpperCase();
        const apikey = new Headers(init?.headers).get('apikey') || '';
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        evoCalls.push({ path: parsed.pathname, method, apikey, body });

        if (parsed.pathname === '/instance/create') {
          createCount += 1;
          return new Response(
            JSON.stringify({
              data: {
                id: body.instanceId,
                name: body.name,
                connected: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (parsed.pathname === '/instance/connect') {
          return new Response(
            JSON.stringify({ data: { webhookUrl: body.webhookUrl } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (parsed.pathname === '/instance/qr') {
          return new Response(
            JSON.stringify({
              data: {
                code: '2@evolution-real-pairing,key,1700000000000',
                qrcode: '',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (parsed.pathname === '/instance/status') {
          return new Response(
            JSON.stringify({
              Connected: loggedIn,
              LoggedIn: loggedIn,
              Name: 'Linked Device',
              jid: loggedIn ? '919876543210:0@s.whatsapp.net' : '',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (
          parsed.pathname === '/instance/logout' ||
          parsed.pathname.startsWith('/instance/delete/') ||
          parsed.pathname === '/instance/disconnect' ||
          parsed.pathname === '/instance/reconnect'
        ) {
          return new Response(JSON.stringify({ message: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.EVOLUTION_GO_TIMEOUT_MS;
    delete process.env.EVOLUTION_GO_SESSION_BUDGET_MS;
  });

  it('returns a real Evolution pairing QR and never a synthetic Helpa QR', async () => {
    const res = await qrPost(jsonRequest('POST', { action: 'generate' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.qr_code).toContain('2@evolution-real-pairing');
    expect(JSON.stringify(body)).not.toContain('helpa-crm-device');
    expect(body.qr_image).toMatch(/^data:image\/png;base64,/);
    expect(JSON.stringify(body)).not.toContain('test-global-api-key');
    expect(JSON.stringify(body)).not.toContain('instanceToken');
    expect(JSON.stringify(body)).not.toContain('provider_token_encrypted');
    expect(JSON.stringify(body)).not.toContain('webhook_secret_hash');
    const create = evoCalls.find((call) => call.path === '/instance/create');
    expect(create?.apikey).toBe('test-global-api-key');
    const connect = evoCalls.find((call) => call.path === '/instance/connect');
    expect(connect?.apikey).not.toBe('test-global-api-key');
    expect(
      String((connect?.body as { webhookUrl?: string }).webhookUrl)
    ).toContain('/api/webhooks/evolution/');
  });

  it('encrypts the instance token before persistence', async () => {
    await qrPost(jsonRequest('POST', { action: 'generate' }));
    const create = evoCalls.find((call) => call.path === '/instance/create');
    const plaintext = String((create?.body as { token?: string }).token);
    const row = db.whatsapp_configs[0];
    expect(plaintext.length).toBeGreaterThan(20);
    expect(row.provider_token_encrypted).not.toBe(plaintext);
    expect(String(row.provider_token_encrypted)).toContain(':');
    expect(String(row.encrypted_access_token)).toBe(
      row.provider_token_encrypted
    );
    expect(row.provider).toBe('evolution');
  });

  it('does not create a second Evolution instance on repeated connect', async () => {
    await qrPost(jsonRequest('POST', { action: 'generate' }));
    await qrPost(jsonRequest('POST', { action: 'generate' }));
    expect(createCount).toBe(1);
    expect(db.whatsapp_configs).toHaveLength(1);
  });

  it('forbids simulate_paired in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await qrPost(
      jsonRequest('POST', {
        action: 'simulate_paired',
        simulate_phone: '+91 89270 93059',
      })
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/disabled/i);
    expect(JSON.stringify(body)).not.toContain('helpa-crm-device');
  });

  it("prevents Tenant A from polling Tenant B's instance", async () => {
    const token = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    db.whatsapp_configs.push({
      id: 'cfg-b',
      account_id: tenantB,
      provider: 'evolution',
      phone_number_id: 'evolution:inst-b',
      provider_instance_id: 'inst-b',
      provider_token_encrypted: encrypt(token),
      encrypted_access_token: encrypt(token),
      webhook_secret_hash: hashWebhookSecret('secret-b'),
      status: 'connecting',
      connection_status: 'waiting_for_scan',
    });
    const res = await qrGet();
    const body = await res.json();
    expect(body.status).toBe('disconnected');
    expect(JSON.stringify(body)).not.toContain('inst-b');
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it('disconnects without deleting conversation history', async () => {
    await qrPost(jsonRequest('POST', { action: 'generate' }));
    const res = await qrDelete();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('disconnected');
    expect(
      db.whatsapp_configs.filter((row) => row.provider === 'evolution')
    ).toHaveLength(0);
    expect(db.messages).toHaveLength(1);
    expect(db.messages[0].content_text).toBe('history');
  });

  it('resumes connect and QR from creating_instance on GET', async () => {
    const token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    db.whatsapp_configs.push({
      id: 'cfg-creating',
      account_id: tenantA,
      provider: 'evolution',
      phone_number_id: 'evolution:inst-a',
      provider_instance_id: 'inst-a',
      provider_token_encrypted: encrypt(token),
      encrypted_access_token: encrypt(token),
      status: 'connecting',
      connection_status: 'creating_instance',
    });
    const res = await qrGet();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.qr_code).toContain('2@evolution-real-pairing');
    expect(evoCalls.some((call) => call.path === '/instance/connect')).toBe(
      true
    );
    expect(evoCalls.some((call) => call.path === '/instance/qr')).toBe(true);
  });

  it('returns JSON when Evolution hangs past the Vercel session budget', async () => {
    vi.stubEnv('VERCEL', '1');
    process.env.EVOLUTION_GO_TIMEOUT_MS = '3000';
    process.env.EVOLUTION_GO_SESSION_BUDGET_MS = '3000';
    globalThis.fetch = vi.fn((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch;

    const started = Date.now();
    const res = await qrPost(jsonRequest('POST', { action: 'generate' }));
    const elapsed = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const body = await res.json();
    expect(elapsed).toBeLessThan(8000);
    expect(contentType).toMatch(/json/i);
    expect(JSON.stringify(body)).not.toMatch(/Unexpected token/);
    expect(JSON.stringify(body)).not.toMatch(/DOCTYPE/);
    expect(body.success === false || body.status === 'creating_instance').toBe(
      true
    );
  });
});
