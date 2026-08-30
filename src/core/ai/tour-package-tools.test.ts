import { describe, expect, it, vi, beforeEach } from 'vitest';
import { aiToolRegistry } from './tools';
import * as db from '@/lib/db/server';

describe('Tour Package AI tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searchTourPackages only queries the current workspace account', async () => {
    const seen: Array<{ table: string; field: string; value: unknown }> = [];
    const empty = {
      data: [],
      error: null,
    };
    vi.spyOn(db, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const builder = {
          select: () => builder,
          eq: (field: string, value: unknown) => {
            seen.push({ table, field, value });
            return builder;
          },
          ilike: () => builder,
          in: () => builder,
          order: () => builder,
          limit: () => builder,
          then: (resolve: (value: typeof empty) => unknown) => resolve(empty),
        };
        return builder;
      },
    } as unknown as ReturnType<typeof db.getAdminClient>);

    const tool = aiToolRegistry.get('searchTourPackages');
    const result = await tool!.execute(
      { query: 'Kashmir package ache?' },
      {
        accountId: 'travel-workspace-a',
        userId: 'user-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        industry: 'travel',
      }
    );

    expect(result.success).toBe(true);
    expect(
      seen.some(
        (entry) =>
          entry.table === 'tour_packages' &&
          entry.field === 'account_id' &&
          entry.value === 'travel-workspace-a'
      )
    ).toBe(true);
    expect(seen.some((entry) => entry.value === 'travel-workspace-b')).toBe(
      false
    );
  });

  it('returns the safe fallback when the database lookup fails', async () => {
    vi.spyOn(db, 'getAdminClient').mockReturnValue({
      from: () => {
        throw new Error('connection refused');
      },
    } as unknown as ReturnType<typeof db.getAdminClient>);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await aiToolRegistry.get('searchTourPackages')!.execute(
      { query: 'Kashmir package ache?' },
      {
        accountId: 'travel-workspace-a',
        userId: 'user-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
      }
    );
    spy.mockRestore();
    expect(result.success).toBe(false);
    expect(result.error).toContain('unable to check the latest package details');
  });
});
