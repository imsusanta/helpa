import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStatusUpdate } from './process-status';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: fromMock }),
}));

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function createQuery(resolve: () => QueryResult) {
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    then(
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockImplementation(async () => resolve());
  return query;
}

describe('handleStatusUpdate tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes message status updates to the resolved account', async () => {
    const messagesQuery = createQuery(() => ({ data: null, error: null }));
    const recipientsQuery = createQuery(() => ({ data: null, error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'messages') return messagesQuery;
      return recipientsQuery;
    });

    await handleStatusUpdate(
      {
        id: 'wamid.STATUS.1',
        status: 'delivered',
        timestamp: '1710000000',
        recipient_id: '919111222333',
      },
      'tenant-a'
    );

    expect(fromMock).toHaveBeenCalledWith('messages');
    expect(messagesQuery.eq).toHaveBeenCalledWith(
      'provider_message_id',
      'wamid.STATUS.1'
    );
    expect(messagesQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
  });

  it('refuses to update messages when the webhook did not resolve a tenant', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('unscoped service-role write must not run');
    });

    await expect(
      handleStatusUpdate({
        id: 'wamid.STATUS.ORPHAN',
        status: 'delivered',
        timestamp: '1710000000',
        recipient_id: '919111222333',
      })
    ).resolves.toBeUndefined();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not update a broadcast recipient that belongs to another tenant', async () => {
    const messagesQuery = createQuery(() => ({ data: null, error: null }));
    const broadcastsQuery = createQuery(() => ({ data: null, error: null }));
    const updates: Array<Record<string, unknown>> = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'messages') return messagesQuery;
      if (table === 'broadcasts') return broadcastsQuery;
      const query = createQuery(() => ({
        data: { id: 'rec-1', status: 'sent', broadcast_id: 'bcast-b' },
        error: null,
      }));
      query.update.mockImplementation((patch: Record<string, unknown>) => {
        updates.push(patch);
        return query;
      });
      return query;
    });

    await handleStatusUpdate(
      {
        id: 'wamid.STATUS.2',
        status: 'delivered',
        timestamp: '1710000000',
        recipient_id: '919111222333',
      },
      'tenant-a'
    );

    expect(fromMock).toHaveBeenCalledWith('broadcasts');
    expect(broadcastsQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
    expect(updates).toHaveLength(0);
  });
});
