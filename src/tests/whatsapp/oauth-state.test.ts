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
          update: (updateData: Record<string, unknown>) => {
            const builder = {
              eq: (field: string, val: unknown) => {
                const matched = mockOauthStates.filter((r) => r[field] === val);
                matched.forEach((r) => Object.assign(r, updateData));
                return {
                  is: (_f: string, _v: unknown) =>
                    Promise.resolve({ data: matched, error: null }),
                  then: (resolve: (res: { error: null }) => void) =>
                    resolve({ error: null }),
                };
              },
            };
            return builder;
          },
        };
      },
    } as unknown as ReturnType<typeof supabaseServer.getAdminClient>);
  });

  it('generates a 64-character cryptographically secure state bound to tenant and user', async () => {
    const result = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
      expiresInSeconds: 900,
    });

    expect(result.state).toBeDefined();
    expect(result.state.length).toBe(64); // 32 bytes hex = 64 chars
    expect(result.expiresAt).toBeDefined();

    expect(mockOauthStates.length).toBe(1);
    const stored = mockOauthStates[0];
    expect(stored.account_id).toBe(tenantA.id);
    expect(stored.user_id).toBe(tenantA.userId);
    expect(stored.state).toBe(result.state);
    expect(stored.used_at).toBeUndefined();
  });

  it('successfully validates and consumes a valid active state', async () => {
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

    // State should now be marked as used in DB
    const stored = mockOauthStates.find((r) => r.state === state);
    expect(stored?.used_at).toBeDefined();
  });

  it('rejects replayed / already used state', async () => {
    const { state } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    // First consumption succeeds
    await validateAndConsumeOAuthState({
      state,
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    // Replay attempt must fail hard
    await expect(
      validateAndConsumeOAuthState({
        state,
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/already been consumed|replay attack/i);
  });

  it('rejects expired OAuth state', async () => {
    // Pre-insert an expired state
    const expiredState = 'expired_state_hex_1234567890abcdef1234567890abcdef';
    mockOauthStates.push({
      id: 'state-expired-1',
      account_id: tenantA.id,
      user_id: tenantA.userId,
      provider: 'meta_whatsapp',
      state: expiredState,
      expires_at: new Date(Date.now() - 60000).toISOString(), // 1 minute in the past
      used_at: null,
      created_at: new Date(Date.now() - 120000).toISOString(),
    });

    await expect(
      validateAndConsumeOAuthState({
        state: expiredState,
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/expired/i);
  });

  it('rejects state when used by a different tenant (tenant mismatch prevention)', async () => {
    const { state } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    // Tenant B attempts to use Tenant A's state
    await expect(
      validateAndConsumeOAuthState({
        state,
        accountId: tenantB.id,
        userId: tenantB.userId,
      })
    ).rejects.toThrow(/tenant mismatch/i);
  });

  it('rejects non-existent or unknown state', async () => {
    await expect(
      validateAndConsumeOAuthState({
        state: 'completely_unknown_state',
        accountId: tenantA.id,
        userId: tenantA.userId,
      })
    ).rejects.toThrow(/Invalid or unknown OAuth state/i);
  });

  it('gracefully handles missing schema cache via HMAC fallback', async () => {
    // Simulate PostgREST schema cache error
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

    const { state, expiresAt } = await generateOAuthState({
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    expect(state).toMatch(/^hmac\./);
    expect(expiresAt).toBeDefined();

    // Validating the HMAC fallback state
    const validated = await validateAndConsumeOAuthState({
      state,
      accountId: tenantA.id,
      userId: tenantA.userId,
    });

    expect(validated.accountId).toBe(tenantA.id);
    expect(validated.userId).toBe(tenantA.userId);
    expect(validated.state).toBe(state);

    // Tenant mismatch with HMAC state
    await expect(
      validateAndConsumeOAuthState({
        state,
        accountId: tenantB.id,
        userId: tenantB.userId,
      })
    ).rejects.toThrow(/tenant mismatch/i);
  });
});
