import type { ResolvedAccountContext } from '@/lib/auth/account';
import type { AccountRole } from '@/lib/auth/roles';
import { requireIndustryWorkplace } from '@/lib/auth/industry';
import { resolveIndustryAlias } from '@/core/modules/terminology';

export function isTravelWorkplaceIndustry(
  industry: string | null | undefined
): boolean {
  return resolveIndustryAlias(industry) === 'travel';
}

/**
 * Travel Agency-only guard. Thin wrapper over the generalized
 * {@link requireIndustryWorkplace} so all industry gates share one
 * server-side enforcement path.
 */
export async function requireTravelWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('travel', minRole, 'Travel Agency');
}
