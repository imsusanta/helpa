import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseServer from '@/lib/supabase/server';
import * as dbServer from '@/lib/db/server';
import { hashWebhookSecret } from '@/core/providers/whatsapp/evolution-go-provider';
import { POST as evolutionWebhook } from '@/app/api/webhooks/evolution/[secret]/route';

const persistMock = vi.hoisted(() => vi.fn());
const triggerAiMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/webhooks/inbound-persistence', () => ({
  persistNormalizedInboundMessage: persistMock,
}));

vi.mock('@/lib/whatsapp/ai', () => ({
  triggerAiResponse: triggerAiMock,
}));

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
      } = {
        filters: [],
        mode: 'select',
        patch: null,
        inserted: null,
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
        if (state.mode === 'insert') {
          return { data: state.inserted, error: null };
        }
        return { data: matched(), error: null };
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (row: Row) => {
          const stored = { id: `id-${store.length + 1}`, ...row };
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
        eq: (key: string, value: unknown) => {
          state.filters.push([key, value]);
          return builder;
        },
        in: () => builder,
        limit: () => builder,
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

describe('Evolution Go webhook', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const secretA = 'url-secret-for-tenant-a';
  let db: Record<string, Row[]>;
  let seenMessageIds: Set<string>;

  beforeEach(() => {
    seenMessageIds = new Set();
    persistMock.mockReset();
    triggerAiMock.mockReset();
    persistMock.mockImplementation(
      async (event: { externalMessageId: string }) => {
        const duplicate = seenMessageIds.has(event.externalMessageId);
        seenMessageIds.add(event.externalMessageId);
        return {
          duplicate,
          accountId: tenantA,
          contactId: 'contact-1',
          conversationId: 'conv-1',
          messageId: `local-${event.externalMessageId}`,
        };
      }
    );
    triggerAiMock.mockResolvedValue(undefined);

    db = {
      whatsapp_configs: [
        {
          account_id: tenantA,
          provider: 'evolution',
          provider_instance_id: 'inst-a',
          webhook_secret_hash: hashWebhookSecret(secretA),
          status: 'connecting',
        },
        {
          account_id: tenantB,
          provider: 'evolution',
          provider_instance_id: 'inst-b',
          webhook_secret_hash: hashWebhookSecret('url-secret-for-tenant-b'),
          status: 'connected',
        },
      ],
      accounts: [{ id: tenantA }, { id: tenantB }],
      account_members: [
        { account_id: tenantA, user_id: 'user-a', role: 'owner' },
      ],
      provider_events: [],
      messages: [],
    };
    const client = makeAdminClient(db);
    vi.spyOn(supabaseServer, 'getAdminClient').mockReturnValue(client as never);
    vi.spyOn(dbServer, 'getAdminClient').mockReturnValue(client as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function post(secret: string, payload: Record<string, unknown>) {
    return evolutionWebhook(
      new Request(`http://localhost/api/webhooks/evolution/${secret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ secret }) }
    );
  }

  it('resolves the tenant from the stored webhook secret mapping', async () => {
    const res = await post(secretA, {
      event: 'Message',
      account_id: tenantB,
      tenant_id: tenantB,
      instanceToken: 'should-not-be-trusted',
      data: {
        key: {
          id: 'evo-msg-1',
          fromMe: false,
          remoteJid: '919111222333@s.whatsapp.net',
        },
        message: { conversation: 'need an appointment' },
        pushName: 'Patient',
      },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock.mock.calls[0][0].clinicId).toBe(tenantA);
    expect(persistMock.mock.calls[0][1].accountId).toBe(tenantA);
    expect(persistMock.mock.calls[0][0].content).toBe('need an appointment');
    expect(JSON.stringify(body)).not.toContain('should-not-be-trusted');
    expect(JSON.stringify(body)).not.toContain(secretA);
  });

  it('ignores a spoofed account_id in the payload', async () => {
    await post(secretA, {
      event: 'Message',
      account_id: tenantB,
      data: {
        key: {
          id: 'evo-msg-2',
          fromMe: false,
          remoteJid: '919111222333@s.whatsapp.net',
        },
        message: { conversation: 'hello' },
      },
    });
    expect(persistMock.mock.calls[0][1].accountId).toBe(tenantA);
    expect(persistMock.mock.calls[0][1].accountId).not.toBe(tenantB);
  });

  it('is idempotent for duplicate webhook deliveries', async () => {
    const payload = {
      event: 'Message',
      data: {
        key: {
          id: 'evo-msg-dup',
          fromMe: false,
          remoteJid: '919111222333@s.whatsapp.net',
        },
        message: { conversation: 'same' },
      },
    };
    const first = await post(secretA, payload);
    const second = await post(secretA, payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.duplicates).toBe(1);
    expect(secondBody.persisted).toBe(0);
    expect(triggerAiMock).toHaveBeenCalledTimes(1);
  });

  it('does not create inbound messages for receipt events', async () => {
    const res = await post(secretA, {
      event: 'Receipt',
      data: { id: 'evo-msg-1', type: 'read' },
    });
    expect(res.status).toBe(200);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('does not persist sender pushName as a WhatsApp group title', async () => {
    const res = await post(secretA, {
      event: 'Message',
      data: {
        key: {
          id: 'evo-group-1',
          fromMe: false,
          remoteJid: '120363316746745895@g.us',
        },
        pushName: 'Ravi',
        message: { conversation: 'group hello' },
      },
    });
    expect(res.status).toBe(200);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock.mock.calls[0][0].patientAddress).toBe(
      '120363316746745895'
    );
    expect(persistMock.mock.calls[0][1].contactName).toBe('WhatsApp group');
    expect(persistMock.mock.calls[0][1].contactName).not.toBe('Ravi');
  });

  it('uses the group subject when Evolution includes it on the message', async () => {
    await post(secretA, {
      event: 'Message',
      data: {
        key: {
          id: 'evo-group-2',
          fromMe: false,
          remoteJid: '120363424522275219@g.us',
        },
        pushName: 'Ravi',
        Info: { Name: { Name: 'Last 100 seats' } },
        message: { conversation: 'seat update' },
      },
    });
    expect(persistMock.mock.calls[0][1].contactName).toBe('Last 100 seats');
  });

  it('upgrades an existing group contact when GroupInfo arrives', async () => {
    db.contacts = [
      {
        id: 'contact-group',
        account_id: tenantA,
        phone: '120363345942229912',
        name: '120363345942229912',
      },
    ];
    const res = await post(secretA, {
      event: 'GroupInfo',
      data: {
        JID: '120363345942229912@g.us',
        Name: { Name: 'Prompt Studio' },
      },
    });
    expect(res.status).toBe(200);
    expect(persistMock).not.toHaveBeenCalled();
    expect(db.contacts[0].name).toBe('Prompt Studio');
  });

  it('rejects an unknown webhook secret', async () => {
    const res = await post('not-the-secret', {
      event: 'Message',
      account_id: tenantA,
      data: {
        key: { id: 'x', fromMe: false, remoteJid: '1@s.whatsapp.net' },
        message: { conversation: 'nope' },
      },
    });
    expect(res.status).toBe(403);
    expect(persistMock).not.toHaveBeenCalled();
  });
});
