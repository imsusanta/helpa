import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbState } = vi.hoisted(() => ({
  dbState: {
    existingByProviderId: new Map<string, { id: string }>(),
    insertError: null as { code?: string; message?: string } | null,
    insertFallbackError: null as { code?: string; message?: string } | null,
    inserts: [] as Record<string, unknown>[],
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
          dbState.inserts.push(payload);
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
        maybeSingle: async () => {
          if (inserting) {
            const isFallback = !('direction' in inserting);
            const err = isFallback
              ? dbState.insertFallbackError
              : dbState.insertError;
            if (err) {
              if (
                String(err.code) === '23505' &&
                inserting.provider_message_id
              ) {
                dbState.existingByProviderId.set(
                  String(inserting.provider_message_id),
                  { id: 'msg-raced' }
                );
              }
              return { data: null, error: err };
            }
            const id = `msg-${dbState.inserts.length}`;
            const providerId = String(
              inserting.provider_message_id || inserting.message_id || ''
            );
            if (providerId) {
              dbState.existingByProviderId.set(providerId, { id });
            }
            return { data: { id }, error: null };
          }
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
          resolve: (value: { data: null; error: null }) => void,
          reject: (reason?: unknown) => void
        ) => {
          if (updating) {
            dbState.updates.push({
              table,
              payload: updating,
              filters: { ...filters },
            });
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
  outboundPreviewText,
  persistOutboundMessage,
  touchConversationPreview,
  pauseActiveFlowRuns,
} from '@/lib/whatsapp/persist-outbound-message';

describe('persistOutboundMessage', () => {
  beforeEach(() => {
    dbState.existingByProviderId.clear();
    dbState.insertError = null;
    dbState.insertFallbackError = null;
    dbState.inserts.length = 0;
    dbState.updates.length = 0;
  });

  it('accepts canonical UUID strings only', () => {
    expect(isValidUuid('3d8f0c1a-6b2e-4c11-9a0d-7e4b5c2a1f90')).toBe(true);
    expect(isValidUuid('wamid.OUT.1')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });

  it('writes direction=outbound with tenant + provider ids', async () => {
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      senderId: '3d8f0c1a-6b2e-4c11-9a0d-7e4b5c2a1f90',
      contentType: 'text',
      contentText: 'Hello from clinic',
      providerMessageId: 'wamid.OUT.1',
      replyToMessageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });

    expect(res).toEqual({
      ok: true,
      messageId: 'msg-1',
      duplicate: false,
    });
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0]).toMatchObject({
      account_id: 'tenant-1',
      conversation_id: 'conv-1',
      direction: 'outbound',
      sender_type: 'agent',
      sender_id: '3d8f0c1a-6b2e-4c11-9a0d-7e4b5c2a1f90',
      content_type: 'text',
      content_text: 'Hello from clinic',
      provider_message_id: 'wamid.OUT.1',
      message_id: 'wamid.OUT.1',
      status: 'sent',
      reply_to_message_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
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
    expect(dbState.inserts[0]).not.toHaveProperty('reply_to_message_id');
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

  it('falls back to the reduced schema when canonical columns are missing', async () => {
    dbState.insertError = {
      code: '42703',
      message: 'column "direction" does not exist',
    };
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
    expect(dbState.inserts[1]).toMatchObject({
      conversation_id: 'conv-1',
      sender_type: 'agent',
      message_id: 'wamid.OUT.3',
      content_text: 'hi',
    });
    expect(dbState.inserts[1]).not.toHaveProperty('direction');
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

  it('returns ok:false when both insert attempts fail', async () => {
    dbState.insertError = { message: 'permission denied' };
    dbState.insertFallbackError = { message: 'permission denied' };
    const res = await persistOutboundMessage({
      accountId: 'tenant-1',
      conversationId: 'conv-1',
      contentType: 'text',
      contentText: 'hi',
      providerMessageId: 'wamid.FAIL',
    });
    expect(res).toEqual({ ok: false, error: 'permission denied' });
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
