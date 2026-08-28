import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateOAuthState,
  validateAndConsumeOAuthState,
} from '@/lib/whatsapp/oauth-state';
import * as supabaseServer from '@/lib/supabase/server';

describe('OAuth State Security & Single-Use Verification', () => {
  const tenantA = { id: 'account-alpha', userId: 'user-alpha' };
  const tenantB = { id: 'account-beta', userId: 'user-beta' };

  let mockOauthStates: Array<Record<string, unknown>>;

  beforeEach(() => {
    mockOauthStates = [];

    vi.spyOn(supabaseServer, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        if (table !== 'oauth_states') {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          insert: (data: Record<string, unknown>) => {
            const row = { id: `state-id-${Date.now()}`, ...data };
            mockOauthStates.push(row);
            return Promise.resolve({ data: row, error: null });
          },
          select: () => {
            let filtered = [...mockOauthStates];
            const builder = {
              eq: (field: string, val: unknown) => {
                filtered = filtered.filter((r) => r[field] === val);
                return builder;
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
            };
            return builder;
          },
          update: (updateData: Record<string, unknown>) => ({
            eq: (field: string, val: unknown) => {
              const matched = mockOauthStates.filter((r) => r[field] === val);
              return {
                is: (nullField: string, nullValue: unknown) => {
                  const claimable = matched.filter(
                    (row) =>
                      row[nullField] === nullValue ||
                      (nullValue === null && row[nullField] === undefined)
                  );
                  claimable.forEach((row) => Object.assign(row, updateData));
                  return {
                    select: async () => ({
                      data: claimable.map((row) => ({ id: row.id })),
                      error: null,
                    }),
                  };
                },
              };
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof supabaseServer.getAdminClient>);
  });

  it('generates a 64-character state bound to tenant and user', async () => {
    const result = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
      expiresInSeconds: 900,
    });

    expect(result.state).toHaveLength(64);
    expect(result.expiresAt).toBeDefined();
    expect(mockOauthStates).toHaveLength(1);
    expect(mockOauthStates[0]).toEqual(
      expect.objectContaining({
        account_id: tenantA.id,
        user_id: tenantA.userId,
        state: result.state,
      })
    );
  });

  it('validates and atomically consumes an active state', async () => {
    const { state } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    const validated = await validateAndConsumeOAuthState({
      state,
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    expect(validated.state).toBe(state);
    expect(validated.accountId).toBe(tenantA.id);
    expect(validated.userId).toBe(tenantA.userId);
    expect(
      mockOauthStates.find((row) => row.state === state)?.used_at
    ).toBeDefined();
  });

  it('rejects replayed state', async () => {
    const { state } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    await validateAndConsumeOAuthState({
      state,
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    await expect(
      validateAndConsumeOAuthState({
        state,
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/already been consumed|replay attack/i);
  });

  it('rejects expired state', async () => {
    const expiredState = 'expired_state_hex_1234567890abcdef1234567890abcdef';
    mockOauthStates.push({
      id: 'state-expired-1',
      account_id: tenantA.id,
      user_id: tenantA.userId,
      provider: 'meta_whatsapp',
      state: expiredState,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      used_at: null,
      created_at: new Date(Date.now() - 120_000).toISOString(),
    });

    await expect(
      validateAndConsumeOAuthState({
        state: expiredState,
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/expired/i);
  });

  it('rejects a state bound to another tenant', async () => {
    const { state } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    await expect(
      validateAndConsumeOAuthState({
        state,
        accountId: tenantB.id,
        userId: tenantB.userId,
      })
    ).rejects.toThrow(/tenant mismatch/i);
  });

  it('rejects an unknown state', async () => {
    await expect(
      validateAndConsumeOAuthState({
        state: 'completely_unknown_state',
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/Invalid or unknown OAuth state/i);
  });

  it('fails closed when persistent state storage is unavailable', async () => {
    vi.spyOn(supabaseServer, 'getAdminClient').mockReturnValue({
      from: () => ({
        insert: () =>
          Promise.resolve({
            data: null,
            error: {
              message:
                "Could not find the table 'public.oauth_states' in the schema cache",
              code: 'PGRST205',
            },
          }),
      }),
    } as unknown as ReturnType<typeof supabaseServer.getAdminClient>);

    await expect(
      generateOAuthState({
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/OAuth state storage is unavailable/i);
  });
});
