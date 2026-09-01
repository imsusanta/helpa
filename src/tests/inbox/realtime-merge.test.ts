import { describe, expect, it } from 'vitest';
import type { Contact, Conversation, Message } from '@/types';
import {
  applyMessageToConversation,
  mergeConversationEvent,
  mergeConversations,
  mergeMessages,
} from '@/lib/inbox/merge';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm-1',
  conversation_id: 'c-1',
  sender_type: 'customer',
  content_type: 'text',
  content_text: 'hello',
  status: 'sent',
  created_at: '2026-08-23T10:00:00.000Z',
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'c-1',
  user_id: 'u-1',
  contact_id: 'contact-1',
  status: 'open',
  unread_count: 0,
  last_message_text: 'hello',
  last_message_at: '2026-08-23T10:00:00.000Z',
  created_at: '2026-08-23T09:00:00.000Z',
  updated_at: '2026-08-23T10:00:00.000Z',
  ...overrides,
});

const contact: Contact = {
  id: 'contact-1',
  user_id: 'u-1',
  account_id: 'account-1',
  name: 'Alice',
  phone: '+15550001',
  created_at: '2026-08-23T09:00:00.000Z',
  updated_at: '2026-08-23T09:00:00.000Z',
};

describe('inbox realtime merge helpers', () => {
  it('retains a realtime inbound row when an older API snapshot arrives', () => {
    const live = message({
      id: 'm-live',
      content_text: 'new reply',
      created_at: '2026-08-23T10:02:00.000Z',
    });
    const fetched = message({ id: 'm-old', content_text: 'older message' });

    const merged = mergeMessages([live], [fetched]);

    expect(merged.map((row) => row.id)).toEqual(['m-old', 'm-live']);
    expect(merged.find((row) => row.id === 'm-live')?.content_text).toBe(
      'new reply'
    );
  });

  it('replaces a matching optimistic outbound row with the canonical row', () => {
    const optimistic = message({
      id: 'temp-1',
      sender_type: 'agent',
      content_text: 'thanks',
      status: 'sending',
      created_at: '2026-08-23T10:03:00.000Z',
    });
    const canonical = message({
      id: 'm-outbound',
      sender_type: 'agent',
      content_text: 'thanks',
      status: 'sent',
      created_at: '2026-08-23T10:03:01.000Z',
    });

    const merged = mergeMessages([optimistic], [canonical]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('m-outbound');
    expect(merged[0].status).toBe('sent');
  });

  it('deduplicates repeated webhook/realtime rows by message id', () => {
    const row = message();
    expect(mergeMessages([row], [row])).toHaveLength(1);
  });

  it('does not let an older hydration response overwrite a newer preview', () => {
    const current = conversation({
      last_message_text: 'latest reply',
      last_message_at: '2026-08-23T10:05:00.000Z',
      updated_at: '2026-08-23T10:05:00.000Z',
      contact,
    });
    const stale = conversation({
      last_message_text: 'old reply',
      last_message_at: '2026-08-23T10:01:00.000Z',
      updated_at: '2026-08-23T10:01:00.000Z',
    });

    const merged = mergeConversationEvent(current, stale);

    expect(merged.last_message_text).toBe('latest reply');
    expect(merged.last_message_at).toBe('2026-08-23T10:05:00.000Z');
    expect(merged.contact?.name).toBe('Alice');
  });

  it('retains a conversation inserted by realtime while list hydration is in flight', () => {
    const live = conversation({ id: 'c-live', last_message_text: 'incoming' });
    const fetched = conversation({ id: 'c-other' });
    const merged = mergeConversations([live], [fetched], new Set(['c-live']));
    expect(merged.map((row) => row.id)).toEqual(['c-other', 'c-live']);
  });

  it('drops missing snapshot rows that were not inserted during the fetch', () => {
    const oldWorkspaceRow = conversation({ id: 'c-old' });
    const fetched = conversation({ id: 'c-current' });
    const merged = mergeConversations([oldWorkspaceRow], [fetched]);
    expect(merged.map((row) => row.id)).toEqual(['c-current']);
  });

  it('does not double-increment unread when the rollup update arrived first', () => {
    const rolledUp = conversation({
      unread_count: 3,
      last_message_at: '2026-08-23T10:05:00.000Z',
    });
    const inbound = message({
      id: 'm-new',
      created_at: '2026-08-23T10:05:00.000Z',
    });

    const merged = applyMessageToConversation(rolledUp, inbound, {
      active: false,
      firstRealtimeInsert: true,
    });

    expect(merged.unread_count).toBe(3);
  });

  it('increments unread immediately when the message event arrives first', () => {
    const beforeRollup = conversation({
      unread_count: 2,
      last_message_at: '2026-08-23T10:04:00.000Z',
    });
    const inbound = message({
      id: 'm-new',
      created_at: '2026-08-23T10:05:00.000Z',
    });

    const merged = applyMessageToConversation(beforeRollup, inbound, {
      active: false,
      firstRealtimeInsert: true,
    });

    expect(merged.unread_count).toBe(3);
  });

  it('still increments unread for a distinct reply sharing the same provider timestamp', () => {
    const existing = conversation({
      unread_count: 2,
      last_message_text: 'first reply',
      last_message_at: '2026-08-23T10:05:00.000Z',
    });
    const inbound = message({
      id: 'm-second',
      content_text: 'second reply',
      created_at: '2026-08-23T10:05:00.000Z',
    });

    const merged = applyMessageToConversation(existing, inbound, {
      active: false,
      firstRealtimeInsert: true,
    });

    expect(merged.unread_count).toBe(3);
  });

  it('deduplicates messages sharing the same provider message_id', () => {
    const live = message({
      id: 'local-temp-uuid',
      message_id: 'wamid.HBgLM...',
      content_text: 'hello from whatsapp',
      status: 'sent',
    });
    const canonical = message({
      id: 'local-db-uuid',
      message_id: 'wamid.HBgLM...',
      content_text: 'hello from whatsapp',
      status: 'delivered',
    });

    const merged = mergeMessages([live], [canonical]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('delivered');
  });

  it('sorts customer prompt before agent response when timestamps are identical down to the second', () => {
    const sameTime = '2026-08-23T10:05:00.000Z';
    const agentReply = message({
      id: 'msg-reply-2',
      sender_type: 'agent',
      content_text: 'How can I assist you?',
      created_at: sameTime,
    });
    const customerPrompt = message({
      id: 'msg-prompt-1',
      sender_type: 'customer',
      content_text: 'Hello doctor',
      created_at: sameTime,
    });

    const merged = mergeMessages([agentReply], [customerPrompt]);
    expect(merged.map((m) => m.id)).toEqual(['msg-prompt-1', 'msg-reply-2']);
  });
});
