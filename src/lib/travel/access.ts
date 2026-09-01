import {
  ForbiddenError,
  requireRole,
  type ResolvedAccountContext,
} from '@/lib/auth/account';
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
  const context = await requireRole(minRole);
  const { data: account, error } = await context.admin
    .from('accounts')
    .select('industry')
    .eq('id', context.accountId)
    .maybeSingle();

  if (error || !isTravelWorkplaceIndustry(account?.industry)) {
    throw new ForbiddenError(
      'This feature is only available to Travel Agency workspaces'
    );
  }

  return context;
}
