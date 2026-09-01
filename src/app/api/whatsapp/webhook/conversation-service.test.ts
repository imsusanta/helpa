import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lookupInternalIdByMetaId,
  flagBroadcastReplyIfAny,
} from './conversation-service';

const { dbMock } = vi.hoisted(() => ({ dbMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: dbMock }),
}));

type Query = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function makeQuery(): Query {
  const q: Query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.maybeSingle.mockReturnValue(q);
  q.update.mockReturnValue(q);
  q.in.mockReturnValue(q);
  q.order.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  return q;
}

describe('lookupInternalIdByMetaId', () => {
  let q: Query;

  beforeEach(() => {
    vi.clearAllMocks();
    q = makeQuery();
    dbMock.mockImplementation((table: string) => {
      if (table === 'messages') return q;
      return makeQuery();
    });
  });

  it('returns null for empty inputs', async () => {
    expect(await lookupInternalIdByMetaId('', 'c', 'a')).toBeNull();
    expect(await lookupInternalIdByMetaId('m', '', 'a')).toBeNull();
    expect(await lookupInternalIdByMetaId('m', 'c', '')).toBeNull();
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('resolves via message_id column first', async () => {
    q.maybeSingle.mockResolvedValue({
      data: { id: 'internal_9' },
      error: null,
    });
    const id = await lookupInternalIdByMetaId('meta_1', 'conv1', 'acct1');
    expect(id).toBe('internal_9');
    // first attempt uses message_id
    expect(q.eq).toHaveBeenCalledWith('message_id', 'meta_1');
  });

  it('falls back to provider_message_id when message_id errors', async () => {
    q.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: '42P01' } })
      .mockResolvedValueOnce({ data: { id: 'internal_2' }, error: null });
    const id = await lookupInternalIdByMetaId('meta_1', 'conv1', 'acct1');
    expect(id).toBe('internal_2');
    const eqCalls = q.eq.mock.calls.map((c: unknown[]) => c[0]);
    expect(eqCalls).toContain('message_id');
    expect(eqCalls).toContain('provider_message_id');
  });

  it('returns null when neither column resolves', async () => {
    q.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: '42P01' } })
      .mockResolvedValueOnce({ data: null, error: null });
    expect(
      await lookupInternalIdByMetaId('meta_1', 'conv1', 'acct1')
    ).toBeNull();
  });

  it('returns null when the lookup throws', async () => {
    q.maybeSingle
      .mockRejectedValueOnce(new Error('schema missing'))
      .mockRejectedValueOnce(new Error('schema missing'));
    expect(
      await lookupInternalIdByMetaId('meta_1', 'conv1', 'acct1')
    ).toBeNull();
  });
});

describe('flagBroadcastReplyIfAny', () => {
  let recQ: Query;
  let updQ: Query;

  beforeEach(() => {
    vi.clearAllMocks();
    recQ = makeQuery();
    updQ = makeQuery();
    dbMock.mockImplementation((table: string) => {
      if (table === 'broadcast_recipients') {
        // first call = select; second call = update
        return recQ;
      }
      return makeQuery();
    });
  });

  it('no-ops when there are no recipients', async () => {
    recQ.limit.mockResolvedValue({ data: [], error: null });
    await flagBroadcastReplyIfAny('acct1', 'contact1');
    expect(updQ.update).not.toHaveBeenCalled();
  });

  it('marks the recipient replied when one is found', async () => {
    recQ.limit.mockResolvedValue({
      data: [{ id: 'rec_1', status: 'sent' }],
      error: null,
    });
    updQ.update.mockReturnValue(updQ);
    updQ.eq.mockResolvedValue({ data: null, error: null });
    await flagBroadcastReplyIfAny('acct1', 'contact1');
  });

  it('does not throw on lookup error', async () => {
    recQ.limit.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(
      flagBroadcastReplyIfAny('acct1', 'contact1')
    ).resolves.toBeUndefined();
  });
});
