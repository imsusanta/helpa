import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleReaction } from './process-reaction';

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}));

// Chainable Supabase query mock: every builder method returns the same
// thenable, so `.from().delete().eq().eq().eq()` and `.from().upsert()`
// both await to the configured result.
const dbState = {
  result: { error: null as unknown },
  from: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  eq: vi.fn(),
  calls: [] as string[],
};

function chainable() {
  return {
    then: (resolve: (v: unknown) => void) => resolve(dbState.result),
    from: dbState.from,
    delete: dbState.delete,
    upsert: dbState.upsert,
    eq: dbState.eq,
  };
}

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => dbState,
}));
vi.mock('./conversation-service', () => ({
  lookupInternalIdByMetaId: lookupMock,
}));

import type { WhatsAppMessage } from './types';

function reactionMsg(
  emoji: string,
  messageId = 'target_meta'
): WhatsAppMessage {
  return {
    id: 'wamid.r',
    from: '919999999999',
    timestamp: '1700000000',
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  };
}

describe('handleReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupMock.mockReset();
    dbState.result = { error: null };
    dbState.calls = [];
    dbState.from = vi.fn(() => chainable());
    dbState.delete = vi.fn(() => chainable());
    dbState.upsert = vi.fn(() => chainable());
    dbState.eq = vi.fn(() => chainable());
  });

  it('skips when the reaction has no message_id', async () => {
    await handleReaction(
      reactionMsg('👍', '') as WhatsAppMessage,
      'conv1',
      'contact1',
      'acct1'
    );
    expect(lookupMock).not.toHaveBeenCalled();
    expect(dbState.from).not.toHaveBeenCalled();
  });

  it('skips when the target message is not found', async () => {
    lookupMock.mockResolvedValue(null);
    await handleReaction(reactionMsg('👍'), 'conv1', 'contact1', 'acct1');
    expect(lookupMock).toHaveBeenCalledWith('target_meta', 'conv1', 'acct1');
    expect(dbState.upsert).not.toHaveBeenCalled();
    expect(dbState.delete).not.toHaveBeenCalled();
  });

  it('deletes the reaction when emoji is empty (removal)', async () => {
    lookupMock.mockResolvedValue('internal_1');
    await handleReaction(reactionMsg(''), 'conv1', 'contact1', 'acct1');
    expect(dbState.delete).toHaveBeenCalled();
    expect(dbState.upsert).not.toHaveBeenCalled();
  });

  it('upserts the reaction for a non-empty emoji', async () => {
    lookupMock.mockResolvedValue('internal_1');
    await handleReaction(reactionMsg('❤️'), 'conv1', 'contact1', 'acct1');
    expect(dbState.upsert).toHaveBeenCalledWith(
      {
        message_id: 'internal_1',
        conversation_id: 'conv1',
        actor_type: 'customer',
        actor_id: 'contact1',
        emoji: '❤️',
      },
      { onConflict: 'message_id,actor_type,actor_id' }
    );
  });

  it('does not throw when upsert fails', async () => {
    lookupMock.mockResolvedValue('internal_1');
    dbState.result = { error: { message: 'boom' } };
    await expect(
      handleReaction(reactionMsg('❤️'), 'conv1', 'contact1', 'acct1')
    ).resolves.toBeUndefined();
  });

  it('does not throw when delete fails', async () => {
    lookupMock.mockResolvedValue('internal_1');
    dbState.result = { error: { message: 'boom' } };
    await expect(
      handleReaction(reactionMsg(''), 'conv1', 'contact1', 'acct1')
    ).resolves.toBeUndefined();
  });
});
