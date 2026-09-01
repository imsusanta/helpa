import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbState } = vi.hoisted(() => ({
  dbState: {
    existingByProviderId: new Map<
      string,
      { id: string; accountId?: string; account_id?: string }
    >(),
    insertError: null as { code?: string; message?: string } | null,
    unknownColumns: new Set<string>(),
    disallowedStatus: new Set<string>(),
    disallowedSenderType: new Set<string>(),
    inserts: [] as Record<string, unknown>[],
    inboundCreatedAt: null as string | null,
    inboundLookups: [] as Record<string, unknown>[],
    updates: [] as Array<{
      table: string;
      payload: Record<string, unknown>;
      filters: Record<string, unknown>;
    }>,
  },
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let inserting: Record<string, unknown> | null = null;
      let updating: Record<string, unknown> | null = null;
      let selecting = false;

      const builder: Record<string, unknown> = {
        select: () => {
          selecting = true;
          return builder;
        },
        insert: (payload: Record<string, unknown>) => {
          inserting = payload;
          dbState.inserts.push({ ...payload });
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          updating = payload;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          if (selecting) {
            const providerId = String(
              filters.provider_message_id || filters.message_id || ''
            );
            return {
              data: dbState.existingByProviderId.get(providerId) || null,
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then: (
          resolve: (value: { data: unknown; error: unknown }) => void,
          reject?: (reason?: unknown) => void
        ) => {
          if (inserting) {
            const missing = Object.keys(inserting).find((key) =>
              dbState.unknownColumns.has(key)
            );
            let err = missing
              ? {
                  code: 'PGRST204',
                  message: `Could not find the '${missing}' column of 'messages' in the schema cache`,
                }
              : dbState.insertError;
            if (
              !err &&
              typeof inserting.status === 'string' &&
              dbState.disallowedStatus.has(inserting.status)
            ) {
              err = {
                code: '23514',
                message:
                  'new row for relation "messages" violates check constraint "messages_status_check"',
              };
            }
            if (
              !err &&
              typeof inserting.sender_type === 'string' &&
              dbState.disallowedSenderType.has(inserting.sender_type)
            ) {
              err = {
                code: '23514',
                message:
                  'new row for relation "messages" violates check constraint "messages_sender_type_check"',
              };
            }
            if (
              err &&
              String(err.code) === '23505' &&
              inserting.provider_message_id
            ) {
              dbState.existingByProviderId.set(
                String(inserting.provider_message_id),
                { id: 'msg-raced' }
              );
            }
            if (!err) {
              const id = String(
                inserting.id || `msg-${dbState.inserts.length}`
              );
              const providerId = String(
                inserting.provider_message_id ||
                  inserting.message_id ||
                  inserting.messageId ||
                  ''
              );
              if (providerId) {
                dbState.existingByProviderId.set(providerId, { id });
              }
              return Promise.resolve({ data: { id }, error: null }).then(
                resolve,
                reject
              );
            }
            return Promise.resolve({
              data: null,
              error: err,
            }).then(resolve, reject);
          }
          if (updating) {
            dbState.updates.push({
              table,
              payload: updating,
              filters: { ...filters },
            });
          }
          if (selecting) {
            if (
              filters.direction === 'inbound' ||
              filters.sender_type === 'customer'
            ) {
              dbState.inboundLookups.push({ ...filters });
              return Promise.resolve({
                data: dbState.inboundCreatedAt
                  ? [{ created_at: dbState.inboundCreatedAt }]
                  : [],
                error: null,
              }).then(resolve, reject);
            }
            const providerId = String(
              filters.provider_message_id ||
                filters.message_id ||
                filters.messageId ||
                ''
            );
            const found = dbState.existingByProviderId.get(providerId);
            const filterAccount = filters.account_id || filters.accountId;
            const foundAccount = found?.account_id || found?.accountId;
            if (
              found &&
              filterAccount &&
              foundAccount &&
              String(foundAccount) !== String(filterAccount)
            ) {
              return Promise.resolve({ data: [], error: null }).then(
                resolve,
                reject
              );
            }
            return Promise.resolve({
              data: found ? [found] : [],
              error: null,
            }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(
            resolve,
            reject
          );
        },
      };

      return builder;
    },
  }),
}));

import {
  isValidUuid,
  missingColumnName,
  outboundPreviewText,
  persistOutboundMessage,
  touchConversationPreview,
  pauseActiveFlowRuns,
  formatPersistError,
} from '@/lib/whatsapp/persist-outbound-message';

const AGENT_UUID = '3d8f0c1a-6b2e-4c11-9a0d-7e4b5c2a1f90';
const REPLY_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('missingColumnName', () => {
  it('parses PostgREST schema-cache and Postgres 42703 messages', () => {
    expect(
      missingColumnName({
        code: 'PGRST204',
        message:
          "Could not find the 'template_name' column of 'messages' in the schema cache",
      })
    ).toBe('template_name');
    expect(
      missingColumnName({
        code: '42703',
        message: 'column "sender_id" of relation "messages" does not exist',
      })
    ).toBe('sender_id');
  });
});

describe('persistOutboundMessage', () => {
  beforeEach(() => {
    dbState.existingByProviderId.clear();
    dbState.insertError = null;
    dbState.unknownColumns.clear();
    dbState.disallowedStatus.clear();
    dbState.disallowedSenderType.clear();
    dbState.inserts.length = 0;
    dbState.updates.length = 0;
    dbState.inboundCreatedAt = null;
    dbState.inboundLookups.length = 0;
  });

  it('accepts canonical UUID strings only', () => {
    expect(isValidUuid(AGENT_UUID)).toBe(true);
    expect(isValidUuid('wamid.OUT.1')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });

  it('inserts inbound-shaped outbound rows including nullable inbound columns', async () => {
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'Hello from clinic',
      providerMessageId: 'wamid.OUT.1',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.duplicate).toBe(false);
    expect(res.messageId).toBe('msg-1');
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0]).toMatchObject({
      account_id: 'tenant-1',
      conversation_id: 'conv-1',
      direction: 'outbound',
      sender_type: 'agent',
      content_type: 'text',
      content_text: 'Hello from clinic',
      provider_message_id: 'wamid.OUT.1',
      message_id: 'wamid.OUT.1',
      status: 'delivered',
      media_url: null,
      reply_to_message_id: null,
      interactive_reply_id: null,
    });
    expect(dbState.inserts[0]).not.toHaveProperty('id');
    expect(dbState.inserts[0]).not.toHaveProperty('template_name');
    expect(dbState.inserts[0]).not.toHaveProperty('sender_id');
  });

  it('persists AI replies as sender_type bot so inbox shows them as outbound', async () => {
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderType: 'bot',
      contentType: 'text',
      contentText: 'I can help you book an appointment.',
      providerMessageId: 'wamid.AI.1',
    });

    expect(res.ok).toBe(true);
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0]).toMatchObject({
      conversation_id: 'conv-1',
      direction: 'outbound',
      sender_type: 'bot',
      content_text: 'I can help you book an appointment.',
      message_id: 'wamid.AI.1',
      status: 'delivered',
    });
  });

  it('retries sender_type agent when the live check rejects bot', async () => {
    dbState.disallowedSenderType.add('bot');

    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderType: 'bot',
      contentType: 'text',
      contentText: 'I can help you book.',
      providerMessageId: 'wamid.AI.BOT.1',
    });

    expect(res.ok).toBe(true);
    expect(dbState.inserts.map((row) => row.sender_type)).toEqual([
      'bot',
      'agent',
    ]);
  });

  it('uses the caller createdAt so AI replies sort after the customer turn', async () => {
    const createdAt = '2026-08-27T10:00:01.000Z';
    await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderType: 'bot',
      contentType: 'text',
      contentText: 'I can help you book.',
      providerMessageId: 'wamid.AI.TS.1',
      replyToMessageId: REPLY_UUID,
      createdAt,
    });

    expect(dbState.inserts[0]).toMatchObject({
      sender_type: 'bot',
      created_at: createdAt,
      reply_to_message_id: REPLY_UUID,
    });
  });

  it('includes optional columns only when they have values', async () => {
    await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderId: AGENT_UUID,
      contentType: 'template',
      contentText: 'Hi',
      providerMessageId: 'wamid.TPL.1',
      templateName: 'hello_world',
      mediaUrl: 'https://cdn.example/a.jpg',
      replyToMessageId: REPLY_UUID,
    });

    expect(dbState.inserts[0]).toMatchObject({
      media_url: 'https://cdn.example/a.jpg',
      reply_to_message_id: REPLY_UUID,
    });
    expect(dbState.inserts[0]).not.toHaveProperty('template_name');
    expect(dbState.inserts[0]).not.toHaveProperty('sender_id');
  });

  it('drops a non-UUID reply_to_message_id rather than failing the insert', async () => {
    await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.OUT.2',
      replyToMessageId: 'wamid.IN.1',
    });
    expect(dbState.inserts[0]).toMatchObject({ reply_to_message_id: null });
  });

  it('is a no-op insert when the provider message already exists', async () => {
    dbState.existingByProviderId.set('wamid.DUP', { id: 'msg-existing' });
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.DUP',
    });
    expect(res).toEqual({
      ok: true,
      messageId: 'msg-existing',
      duplicate: true,
    });
    expect(dbState.inserts).toHaveLength(0);
  });

  it('scopes inbound latency lookup to the same account and conversation', async () => {
    dbState.inboundCreatedAt = '2026-08-01T10:00:00.000Z';
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'reply',
      providerMessageId: 'wamid.OUT.LAT',
      createdAt: '2026-08-01T10:00:09.000Z',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.duplicate).toBe(false);
    expect(dbState.inboundLookups[0]).toMatchObject({
      account_id: 'tenant-1',
      conversation_id: 'conv-1',
      direction: 'inbound',
    });
  });

  it('does not treat another tenant provider id as a duplicate', async () => {
    dbState.existingByProviderId.set('wamid.SHARED', {
      id: 'msg-other',
      accountId: 'tenant-b',
      account_id: 'tenant-b',
    });
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.SHARED',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.duplicate).toBe(false);
    expect(dbState.inserts.length).toBeGreaterThan(0);
    expect(dbState.inserts[0]).toMatchObject({
      account_id: 'tenant-1',
      provider_message_id: 'wamid.SHARED',
      direction: 'outbound',
    });
  });

  it('strips inbound nullable columns when production messages lacks them', async () => {
    dbState.unknownColumns.add('interactive_reply_id');

    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderId: AGENT_UUID,
      contentType: 'template',
      contentText: 'Hi',
      providerMessageId: 'wamid.TPL.2',
      templateName: 'hello_world',
    });

    expect(res.ok).toBe(true);
    expect(dbState.inserts).toHaveLength(2);
    expect(dbState.inserts[0]).toHaveProperty('interactive_reply_id', null);
    expect(dbState.inserts[1]).not.toHaveProperty('interactive_reply_id');
    expect(dbState.inserts[1]).toMatchObject({
      conversation_id: 'conv-1',
      direction: 'outbound',
      sender_type: 'agent',
      message_id: 'wamid.TPL.2',
    });
  });

  it('strips unknown canonical columns such as direction and retries', async () => {
    dbState.unknownColumns.add('direction');
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.OUT.3',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(false);
    expect(dbState.inserts).toHaveLength(2);
    expect(dbState.inserts[0]).toHaveProperty('direction', 'outbound');
    expect(dbState.inserts[1]).not.toHaveProperty('direction');
    expect(dbState.inserts[1]).toMatchObject({
      conversation_id: 'conv-1',
      sender_type: 'agent',
      message_id: 'wamid.OUT.3',
      content_text: 'hi',
    });
  });

  it('treats a unique-violation race as success', async () => {
    dbState.insertError = { code: '23505', message: 'duplicate key' };
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.RACE',
    });
    expect(res).toEqual({
      ok: true,
      messageId: 'msg-raced',
      duplicate: true,
    });
  });

  it('returns ok:false when insert fails for a non-schema reason', async () => {
    dbState.insertError = { code: '42501', message: 'permission denied' };
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.FAIL',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/permission denied/);
  });

  it('retries status when messages_status_check rejects delivered/sent', async () => {
    dbState.disallowedStatus.add('delivered');
    dbState.disallowedStatus.add('sent');

    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.STATUS',
    });

    expect(res.ok).toBe(true);
    expect(dbState.inserts.map((row) => row.status)).toEqual([
      'delivered',
      'sent',
      'pending',
    ]);
  });

  it('falls back to camelCase when snake_case required columns are missing', async () => {
    for (const column of [
      'conversation_id',
      'sender_type',
      'content_type',
      'content_text',
      'media_url',
      'message_id',
      'status',
      'reply_to_message_id',
      'interactive_reply_id',
      'created_at',
      'account_id',
      'direction',
      'provider_message_id',
      'updated_at',
    ]) {
      dbState.unknownColumns.add(column);
    }

    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.LEGACY',
    });

    expect(res.ok).toBe(true);
    const last = dbState.inserts[dbState.inserts.length - 1];
    expect(last).toMatchObject({
      conversationId: 'conv-1',
      senderType: 'agent',
      messageId: 'wamid.LEGACY',
      contentText: 'hi',
    });
    expect(last).not.toHaveProperty('conversation_id');
  });
});

describe('touchConversationPreview', () => {
  beforeEach(() => {
    dbState.updates.length = 0;
  });

  it('updates last_message fields scoped to the tenant', async () => {
    await touchConversationPreview({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      previewText: 'Hello from clinic',
      messageAt: '2026-08-27T04:00:00.000Z',
    });
    expect(dbState.updates[0]).toMatchObject({
      table: 'conversations',
      payload: {
        last_message_text: 'Hello from clinic',
        last_message_at: '2026-08-27T04:00:00.000Z',
        updated_at: '2026-08-27T04:00:00.000Z',
      },
      filters: {
        id: 'conv-1',
        account_id: 'tenant-1',
      },
    });
  });
});

describe('pauseActiveFlowRuns', () => {
  beforeEach(() => {
    dbState.updates.length = 0;
  });

  it('skips when there is no contact', async () => {
    await pauseActiveFlowRuns({ accountId: 'tenant-1', contactId: null });
    expect(dbState.updates).toHaveLength(0);
  });

  it('pauses active runs for the contact on this tenant', async () => {
    await pauseActiveFlowRuns({
      accountId: 'tenant-1',
      contactId: 'cnt-1',
    });
    expect(dbState.updates[0]).toMatchObject({
      table: 'flow_runs',
      payload: {
        status: 'paused_by_agent',
        end_reason: 'agent_replied',
      },
      filters: {
        account_id: 'tenant-1',
        contact_id: 'cnt-1',
        status: 'active',
      },
    });
  });
});

describe('outboundPreviewText', () => {
  it('falls back to a typed placeholder when the body is empty', () => {
    expect(
      outboundPreviewText({ contentText: null, contentType: 'image' })
    ).toBe('[image]');
    expect(
      outboundPreviewText({ contentText: 'Hi', contentType: 'text' })
    ).toBe('Hi');
  });
});

describe('formatPersistError', () => {
  it('returns "Unknown error" for falsy input', () => {
    expect(formatPersistError(undefined)).toBe('Unknown error');
    expect(formatPersistError(null)).toBe('Unknown error');
  });

  it('returns the message for a non-object primitive', () => {
    expect(formatPersistError('boom')).toBe('boom');
  });

  it('returns the Error message for an Error instance', () => {
    expect(formatPersistError(new Error('db down'))).toBe('db down');
  });

  it('joins string code/message/details/hint with separators', () => {
    expect(
      formatPersistError({
        code: '42501',
        message: 'permission denied',
        details: 'row-level security',
        hint: 'use the tenant predicate',
      })
    ).toBe(
      '42501 — permission denied — row-level security — use the tenant predicate'
    );
  });

  it('skips non-string and empty fields', () => {
    expect(
      formatPersistError({ code: 'P0001', message: '', details: 123 })
    ).toBe('P0001');
  });
});
