import { requireRole, type ResolvedAccountContext } from '@/lib/auth/account';
import type { AccountRole } from '@/lib/auth/roles';
import { resolveIndustryAlias } from '@/core/modules/terminology';

export function isTravelWorkplaceIndustry(
  industry: string | null | undefined
): boolean {
  return resolveIndustryAlias(industry) === 'travel';
}

export async function requireTravelWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireRole(minRole);
}
