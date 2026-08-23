import { describe, expect, it } from 'vitest';
import type { Message } from '@/types';
import { mergeMessageSnapshots } from './client-cache';

function message(overrides: Partial<Message>): Message {
  return {
    id: 'server-1',
    conversation_id: 'conversation-1',
    sender_type: 'agent',
    content_type: 'text',
    content_text: 'Hello',
    status: 'sent',
    created_at: '2026-08-23T15:00:00.000Z',
    ...overrides,
  };
}

describe('mergeMessageSnapshots', () => {
  it('keeps an optimistic message while the server snapshot is stale', () => {
    const optimistic = message({ id: 'temp-1', status: 'sending' });
    expect(mergeMessageSnapshots([], [optimistic])).toEqual([optimistic]);
  });

  it('keeps a failed optimistic message visible for retry', () => {
    const failed = message({ id: 'temp-1', status: 'failed' });
    expect(mergeMessageSnapshots([], [failed])).toEqual([failed]);
  });

  it('replaces an equivalent optimistic message with the confirmed row', () => {
    const optimistic = message({ id: 'temp-1', status: 'sending' });
    const confirmed = message({
      id: 'server-1',
      status: 'sent',
      created_at: '2026-08-23T15:00:01.000Z',
    });
    expect(mergeMessageSnapshots([confirmed], [optimistic])).toEqual([
      confirmed,
    ]);
  });

  it('does not duplicate rows that already share the server id', () => {
    const confirmed = message({ id: 'server-1', status: 'delivered' });
    expect(mergeMessageSnapshots([confirmed], [confirmed])).toEqual([
      confirmed,
    ]);
  });

  it('does not reconcile distinct outgoing messages', () => {
    const first = message({ id: 'server-1', content_text: 'First' });
    const second = message({
      id: 'temp-2',
      content_text: 'Second',
      status: 'sending',
    });
    expect(mergeMessageSnapshots([first], [second])).toEqual([first, second]);
  });
});
