import {
  ForbiddenError,
  requireRole,
  type ResolvedAccountContext,
} from '@/lib/auth/account';
import type { AccountRole } from '@/lib/auth/roles';
import { resolveIndustryAlias } from '@/modules/terminology';

export function isTravelWorkplaceIndustry(
  industry: string | null | undefined
): boolean {
  return resolveIndustryAlias(industry) === 'travel';
}

export async function requireTravelWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  const ctx = await requireRole(minRole);
  const { data: account, error } = await ctx.admin
    .from('accounts')
    .select('industry')
    .eq('id', ctx.accountId)
    .maybeSingle();

  if (error || !account) {
    throw new ForbiddenError('Account not found');
  }

  if (!isTravelWorkplaceIndustry(account.industry as string | null)) {
    throw new ForbiddenError(
      'Tour Packages are only available in the Travel Workplace'
    );
  }

  return ctx;
}
