import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => {
    throw new Error('database unavailable');
  },
}));

import {
  assertWhatsAppMessageQuota,
  checkFeatureAccess,
  checkPlanLimits,
} from '@/lib/saas/subscription';

describe('subscription entitlement fail-closed', () => {
  it('denies feature access when entitlement lookup throws', async () => {
    const result = await checkFeatureAccess('acct-1', 'core.inbox');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Unable to verify plan access/i);
  });

  it('denies usage when plan-limit lookup throws', async () => {
    const result = await checkPlanLimits('acct-1', 'max_contacts');
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
    expect(result.reason).toMatch(/Unable to verify plan limits/i);
  });

  it('blocks WhatsApp sends when quota lookup throws', async () => {
    const result = await assertWhatsAppMessageQuota('acct-1', 1);
    expect(result.allowed).toBe(false);
  });
});
