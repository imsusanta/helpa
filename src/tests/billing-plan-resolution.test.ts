import { describe, expect, it, vi } from 'vitest';
import {
  PlanNotFoundError,
  findPlanBySlug,
  getPlanBySlug,
} from '@/core/billing/plans';
import * as appwriteCompat from '@/lib/db/server';

function mockEmptyPlanCatalog() {
  vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
}

describe('billing plan resolution', () => {
  it('supports explicit legacy plan aliases', async () => {
    mockEmptyPlanCatalog();

    await expect(getPlanBySlug('plan_professional')).resolves.toMatchObject({
      id: 'plan_growth',
      slug: 'growth',
    });
    await expect(getPlanBySlug('plan_business')).resolves.toMatchObject({
      id: 'plan_pro',
      slug: 'pro',
    });
  });

  it('fails closed for unknown plan identifiers', async () => {
    mockEmptyPlanCatalog();

    await expect(findPlanBySlug('unknown-plan')).resolves.toBeNull();
    await expect(getPlanBySlug('unknown-plan')).rejects.toBeInstanceOf(
      PlanNotFoundError
    );
  });
});
