/**
 * Inbound message pipeline — end-to-end persistence tests.
 *
 * These tests drive the real POST handler and the real `processMessage`
 * persistence path against an in-memory fake of the Supabase admin client.
 * Only the boundaries that are not part of the inbound pipeline are mocked
 * (tenant resolution, contact/conversation lookup, and the post-persistence
 * flow/automation/AI fan-out).
 *
 * The regression they lock down: `inbound_webhook_events` — an auxiliary
 * idempotency ledger with no CREATE TABLE migration — was treated as a hard
 * precondition, so its 42P01 failure rejected every customer reply with a 500
 * before the message was ever written to `messages`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { POST as webhookHandler } from '@/app/api/whatsapp/webhook/route';
import * as supabaseServer from '@/lib/supabase/server';
import * as tenantResolver from '@/core/whatsapp/tenant-resolver';
import * as contactService from '@/app/api/whatsapp/webhook/contact-service';
import * as conversationService from '@/app/api/whatsapp/webhook/conversation-service';
import * as safeRecord from '@/lib/metrics/safe-record';

vi.mock('@/lib/flows/engine', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  dispatchInboundToFlows: vi.fn(async () => ({ consumed: false })),
}));
vi.mock('@/lib/automations/engine', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runAutomationsForTrigger: vi.fn(async () => ({
    matched: false,
    replied: false,
  })),
}));
vi.mock('@/lib/whatsapp/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  triggerAiResponse: vi.fn(async () => undefined),
}));
vi.mock('@/core/ai/chatbot-settings', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccountChatbotSettings: vi.fn(async () => ({ enabled: false })),
}));

const SECRET = 'inbound-pipeline-test-secret';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const CONVERSATION_ID = '44444444-4444-4444-8444-444444444444';
const PHONE_NUMBER_ID = 'phone-num-9001';

type Row = Record<string, unknown>;

interface FakeOptions {
  /** Simulate the root-cause defect: ledger table does not exist (42P01). */
  ledgerMissing?: boolean;
  /** Simulate a database without the atomic rollup function. */
  rpcMissing?: boolean;
  /** Simulate a legacy conversations table that rejects snake_case rollups. */
  canonicalConversationUpdateFails?: boolean;
  /** Force the pre-insert dedupe SELECT to return nothing, so the insert
   *  itself must handle the unique violation. */
  blindDedupeRead?: boolean;
  /** Hard-fail the insert for one specific provider message id. */
  failOnMessageId?: string;
}

const MISSING_TABLE = {
  code: '42P01',
  message: 'relation "inbound_webhook_events" does not exist',
};
const UNIQUE_VIOLATION = {
  code: '23505',
  message: 'duplicate key value violates unique constraint',
};

function createFakeAdmin(store: Record<string, Row[]>, opts: FakeOptions = {}) {
  const rows = (table: string): Row[] => {
    if (!store[table]) store[table] = [];
    return store[table];
  };

  const matches = (row: Row, filters: Array<[string, unknown]>) =>
    filters.every(([field, value]) => row[field] === value);

  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Row | null = null;
    let headOnly = false;

    const run = async () => {
      if (table === 'inbound_webhook_events' && opts.ledgerMissing) {
        return { data: null, error: MISSING_TABLE, count: null };
      }

      if (op === 'insert' && payload) {
        const providerId = (payload.message_id ?? payload.messageId) as
          string | undefined;

        if (
          table === 'messages' &&
          providerId &&
          providerId === opts.failOnMessageId
        ) {
          return {
            data: null,
            error: { code: '42501', message: 'permission denied' },
            count: null,
          };
        }

        // Emulate the unique indexes that guarantee at-most-once delivery.
        const key =
          table === 'inbound_webhook_events' ? 'event_id' : 'message_id';
        const candidate = (payload[key] ??
          (key === 'message_id' ? payload.messageId : undefined)) as
          string | undefined;
        if (
          candidate &&
          rows(table).some(
            (r) => (r[key] ?? r.messageId ?? r.message_id) === candidate
          )
        ) {
          return { data: null, error: UNIQUE_VIOLATION, count: null };
        }

        const inserted = {
          id: `${table}-${rows(table).length + 1}`,
          ...payload,
        };
        rows(table).push(inserted);
        return { data: inserted, error: null, count: null };
      }

      if (op === 'update' && payload) {
        if (
          table === 'conversations' &&
          opts.canonicalConversationUpdateFails &&
          Object.hasOwn(payload, 'unread_count')
        ) {
          return {
            data: null,
            error: {
              code: '42703',
              message: 'column unread_count does not exist',
            },
            count: null,
          };
        }
        const matched = rows(table).filter((r) => matches(r, filters));
        matched.forEach((r) => Object.assign(r, payload));
        return { data: matched, error: null, count: null };
      }

      if (table === 'messages' && opts.blindDedupeRead && !headOnly) {
        return { data: [], error: null, count: 0 };
      }

      const matched = rows(table).filter((r) => matches(r, filters));
      if (headOnly) return { data: null, error: null, count: matched.length };
      return { data: matched, error: null, count: matched.length };
    };

    const chain = {
      select: (_cols?: string, options?: { head?: boolean }) => {
        op = 'select';
        headOnly = Boolean(options?.head);
        return chain;
      },
      insert: (data: Row) => {
        op = 'insert';
        payload = data;
        return chain;
      },
      update: (data: Row) => {
        op = 'update';
        payload = data;
        return chain;
      },
      eq: (field: string, value: unknown) => {
        filters.push([field, value]);
        return chain;
      },
      in: () => chain,
      not: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        const res = await run();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return { data, error: res.error };
      },
      single: async () => {
        const res = await run();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return { data, error: res.error };
      },
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown
      ) => run().then(resolve, reject),
    };

    return chain;
  }

  return {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'apply_inbound_message_to_conversation') {
        return { data: null, error: { code: '42883', message: 'no function' } };
      }
      if (opts.rpcMissing) {
        return {
          data: null,
          error: { code: '42883', message: 'function does not exist' },
        };
      }

      const conv = rows('conversations').find(
        (c) => c.id === args.p_conversation_id
      );
      if (!conv) return { data: [], error: null };

      const previous = conv.last_message_at
        ? new Date(conv.last_message_at as string)
        : null;
      const incoming = new Date(args.p_message_at as string);
      if (!previous || incoming >= previous) {
        conv.last_message_text = args.p_preview;
        conv.last_message_at = args.p_message_at;
      }
      conv.unread_count = Number(conv.unread_count ?? 0) + 1;
      if (conv.status === 'closed') conv.status = 'open';
      conv.updated_at = new Date().toISOString();

      return { data: [conv], error: null };
    },
  } as unknown as ReturnType<typeof supabaseServer.getAdminClient>;
}

function signedRequest(body: unknown): Request {
  const raw = JSON.stringify(body);
  const hmac = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return new Request('http://localhost:3000/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': `sha256=${hmac}`,
    },
    body: raw,
  });
}

interface MessagePayload {
  id: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  timestamp?: string;
}

function inboundPayload(
  messages: MessagePayload[],
  phoneNumberId = PHONE_NUMBER_ID
) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001111',
                phone_number_id: phoneNumberId,
              },
              contacts: [
                { profile: { name: 'Priya Sharma' }, wa_id: '919876543210' },
              ],
              messages: messages.map((m) => ({
                from: '919876543210',
                timestamp: m.timestamp ?? '1760000000',
                ...m,
              })),
            },
          },
        ],
      },
    ],
  };
}

describe('Inbound message pipeline', () => {
  let store: Record<string, Row[]>;

  const seedConversation = (overrides: Row = {}) => {
    store.conversations = [
      {
        id: CONVERSATION_ID,
        account_id: ACCOUNT_ID,
        contact_id: CONTACT_ID,
        channel: 'whatsapp',
        status: 'open',
        unread_count: 0,
        last_message_text: '',
        last_message_at: null,
        ...overrides,
      },
    ];
    return store.conversations[0];
  };

  const install = (opts: FakeOptions = {}) => {
    vi.spyOn(supabaseServer, 'getAdminClient').mockImplementation(() =>
      createFakeAdmin(store, opts)
    );
  };

  beforeEach(() => {
    process.env.META_APP_SECRET = SECRET;
    store = { messages: [], conversations: [], inbound_webhook_events: [] };
    seedConversation();

    vi.spyOn(tenantResolver, 'resolveTenantByPhoneNumberId').mockImplementation(
      async (phoneNumberId: string) =>
        phoneNumberId === PHONE_NUMBER_ID
          ? {
              tenantId: ACCOUNT_ID,
              userId: OWNER_USER_ID,
              phoneNumberId: PHONE_NUMBER_ID,
              wabaId: 'waba-1',
              accessToken: 'TOKEN',
            }
          : null
    );

    vi.spyOn(contactService, 'findOrCreateContact').mockResolvedValue({
      contact: { id: CONTACT_ID, name: 'Priya Sharma' },
      wasCreated: false,
    } as never);
    vi.spyOn(
      conversationService,
      'findOrCreateConversation'
    ).mockImplementation(async () => store.conversations[0] as never);
    vi.spyOn(conversationService, 'lookupInternalIdByMetaId').mockResolvedValue(
      null
    );
    vi.spyOn(conversationService, 'flagBroadcastReplyIfAny').mockResolvedValue(
      undefined as never
    );
    vi.spyOn(safeRecord, 'safeRecordOutcomeEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists an inbound reply with tenant scoping and updates the conversation rollup', async () => {
    install();

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          {
            id: 'wamid.INBOUND_1',
            type: 'text',
            text: { body: 'Yes, 3pm works for me' },
          },
        ])
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(1);
    expect(body.failed).toBe(0);

    expect(store.messages).toHaveLength(1);
    const saved = store.messages[0];
    // Tenant + direction + provider id are what the working outbound path
    // writes; inbound was omitting all three, leaving rows unscoped and
    // outside the provider-message unique index.
    expect(saved.account_id).toBe(ACCOUNT_ID);
    expect(saved.conversation_id).toBe(CONVERSATION_ID);
    expect(saved.direction).toBe('inbound');
    expect(saved.sender_type).toBe('customer');
    expect(saved.provider_message_id).toBe('wamid.INBOUND_1');
    expect(saved.message_id).toBe('wamid.INBOUND_1');
    expect(saved.content_text).toBe('Yes, 3pm works for me');
    expect(saved.content_type).toBe('text');
    expect(saved.status).toBe('delivered');
    // Timestamp comes from the provider, not from wall-clock receipt time.
    expect(saved.created_at).toBe(new Date(1760000000 * 1000).toISOString());

    const conv = store.conversations[0];
    expect(conv.last_message_text).toBe('Yes, 3pm works for me');
    expect(conv.last_message_at).toBe(
      new Date(1760000000 * 1000).toISOString()
    );
    expect(conv.unread_count).toBe(1);

    expect(vi.mocked(safeRecord.safeRecordOutcomeEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        eventName: 'inbound_message_received',
        attributes: expect.objectContaining({
          channel: 'whatsapp',
          conversation_id: CONVERSATION_ID,
        }),
      })
    );
  });

  it('ROOT CAUSE: still persists the reply when the idempotency ledger table is missing', async () => {
    install({ ledgerMissing: true });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          {
            id: 'wamid.LEDGER_GONE',
            type: 'text',
            text: { body: 'Is the clinic open today?' },
          },
        ])
      )
    );

    // Before the fix this returned 500 and `messages` stayed empty forever,
    // no matter how many times Meta retried.
    expect(res.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].content_text).toBe('Is the clinic open today?');
    expect(store.conversations[0].unread_count).toBe(1);
  });

  it('does not create a second inbox message when Meta retries the same event', async () => {
    install();
    const payload = inboundPayload([
      { id: 'wamid.RETRIED', type: 'text', text: { body: 'Please confirm' } },
    ]);

    const first = await webhookHandler(signedRequest(payload));
    const second = await webhookHandler(signedRequest(payload));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).duplicates).toBe(1);

    expect(store.messages).toHaveLength(1);
    // The unread badge must not be double-counted on redelivery.
    expect(store.conversations[0].unread_count).toBe(1);
  });

  it('treats a unique violation on insert as an idempotent success', async () => {
    // Dedupe SELECT is blind, so two concurrent redeliveries both reach the
    // insert and the database index is the only thing standing between them.
    install({ blindDedupeRead: true });
    store.messages.push({
      id: 'existing',
      account_id: ACCOUNT_ID,
      conversation_id: CONVERSATION_ID,
      message_id: 'wamid.RACED',
      direction: 'inbound',
    });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          { id: 'wamid.RACED', type: 'text', text: { body: 'Hello?' } },
        ])
      )
    );

    expect(res.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    expect(store.conversations[0].unread_count).toBe(0);
  });

  it('acknowledges without persisting when the phone number maps to no workspace', async () => {
    install();

    const res = await webhookHandler(
      signedRequest(
        inboundPayload(
          [{ id: 'wamid.NO_TENANT', type: 'text', text: { body: 'Hi' } }],
          'phone-num-not-registered'
        )
      )
    );

    // 200, because a retry can never make an unknown number routable and an
    // endless retry loop risks Meta disabling the subscription for everyone.
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(1);
    expect(store.messages).toHaveLength(0);
  });

  it('still delivers a sibling message when one message in the batch fails', async () => {
    install({ failOnMessageId: 'wamid.BAD' });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          { id: 'wamid.BAD', type: 'text', text: { body: 'first' } },
          { id: 'wamid.GOOD', type: 'text', text: { body: 'second' } },
        ])
      )
    );

    // Reports 500 so Meta redelivers the batch and the failed message gets
    // another chance...
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.persisted).toBe(1);

    // ...but the healthy sibling was NOT dropped. Previously the first
    // failure rethrew and aborted the whole batch.
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].message_id).toBe('wamid.GOOD');

    // The failed event is recorded for replay/alerting.
    const failed = store.inbound_webhook_events.find(
      (e) => e.event_id === 'wamid.BAD'
    );
    expect(failed?.status).toBe('failed');
  });

  it('parses a template quick-reply (type: "button") into text and a reply id', async () => {
    install();

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          {
            id: 'wamid.BUTTON_1',
            type: 'button',
            button: { text: 'Confirm appointment', payload: 'appt_ack_9001' },
          },
        ])
      )
    );

    expect(res.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    const saved = store.messages[0];
    // Previously stored as "[Unsupported message type: button]" with a null
    // reply id, which broke appointment-reminder confirmations.
    expect(saved.content_text).toBe('Confirm appointment');
    expect(saved.interactive_reply_id).toBe('appt_ack_9001');
    expect(saved.content_type).toBe('text');
    expect(store.conversations[0].last_message_text).toBe(
      'Confirm appointment'
    );
  });

  it('reopens a closed conversation when the customer replies', async () => {
    install();
    seedConversation({ status: 'closed', unread_count: 0 });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          {
            id: 'wamid.REOPEN',
            type: 'text',
            text: { body: 'Actually, one more question' },
          },
        ])
      )
    );

    expect(res.status).toBe(200);
    // A reply to a closed thread must not stay hidden behind the inbox's
    // status filter.
    expect(store.conversations[0].status).toBe('open');
    expect(store.conversations[0].unread_count).toBe(1);
  });

  it('falls back to a direct conversation update when the atomic RPC is unavailable', async () => {
    install({ rpcMissing: true });
    seedConversation({ status: 'closed', unread_count: 4 });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          { id: 'wamid.NO_RPC', type: 'text', text: { body: 'ping' } },
        ])
      )
    );

    expect(res.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    const conv = store.conversations[0];
    expect(conv.unread_count).toBe(5);
    expect(conv.last_message_text).toBe('ping');
    expect(conv.status).toBe('open');
  });

  it('does not double-count unread when the legacy conversation fallback is retried', async () => {
    install({
      ledgerMissing: true,
      rpcMissing: true,
      canonicalConversationUpdateFails: true,
    });
    const conv = seedConversation({ status: 'closed' });
    delete conv.unread_count;
    delete conv.last_message_text;
    delete conv.last_message_at;
    Object.assign(conv, {
      unreadCount: 0,
      lastMessageText: '',
      lastMessageAt: null,
    });
    const payload = inboundPayload([
      {
        id: 'wamid.LEGACY_RETRY',
        type: 'text',
        text: { body: 'still there?' },
      },
    ]);

    const first = await webhookHandler(signedRequest(payload));
    const retry = await webhookHandler(signedRequest(payload));

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    expect(conv.unreadCount).toBe(1);
    expect(conv.lastMessageText).toBe('still there?');
    expect(store.messages[0].inbound_rollup_applied_at).toBeTruthy();
  });

  it('does not advance the preview for an out-of-order older redelivery', async () => {
    install();
    seedConversation({
      last_message_text: 'newest message',
      last_message_at: new Date(1760000000 * 1000).toISOString(),
      unread_count: 1,
    });

    const res = await webhookHandler(
      signedRequest(
        inboundPayload([
          {
            id: 'wamid.OLDER',
            type: 'text',
            text: { body: 'an older message' },
            timestamp: '1759000000',
          },
        ])
      )
    );

    expect(res.status).toBe(200);
    expect(store.messages).toHaveLength(1);
    const conv = store.conversations[0];
    // Message is stored, but the thread preview is not rewound.
    expect(conv.last_message_text).toBe('newest message');
    expect(conv.unread_count).toBe(2);
  });

  it('rejects an unsigned request without touching the database', async () => {
    install();

    const res = await webhookHandler(
      new Request('http://localhost:3000/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          inboundPayload([
            { id: 'wamid.UNSIGNED', type: 'text', text: { body: 'spoofed' } },
          ])
        ),
      })
    );

    expect(res.status).toBe(401);
    expect(store.messages).toHaveLength(0);
  });
});
