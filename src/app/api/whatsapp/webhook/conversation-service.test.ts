import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupInternalIdByMetaId } from './conversation-service';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: fromMock }),
}));

type QueryResult = {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
};

function createQuery(resolve: () => QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockImplementation(async () => resolve());
  return query;
}

describe('lookupInternalIdByMetaId tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes the provider-id lookup to account and conversation', async () => {
    const query = createQuery(() => ({ data: { id: 'msg-1' }, error: null }));
    fromMock.mockReturnValue(query);

    const id = await lookupInternalIdByMetaId(
      'wamid.PARENT',
      'conv-a',
      'tenant-a'
    );

    expect(id).toBe('msg-1');
    expect(query.eq).toHaveBeenCalledWith('message_id', 'wamid.PARENT');
    expect(query.eq).toHaveBeenCalledWith('conversation_id', 'conv-a');
    expect(query.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
  });

  it('does not return another tenant row and skips empty scope', async () => {
    expect(await lookupInternalIdByMetaId('wamid.X', 'conv-a', '')).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();

    const query = createQuery(() => ({ data: null, error: null }));
    fromMock.mockReturnValue(query);
    expect(
      await lookupInternalIdByMetaId('wamid.X', 'conv-a', 'tenant-a')
    ).toBeNull();
    expect(query.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
  });
});
