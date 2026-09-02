import {
  ForbiddenError,
  requireRole,
  type ResolvedAccountContext,
} from './account';
import type { AccountRole } from './roles';
import {
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/core/modules/terminology';

/**
 * Server-side industry access guard — the generalized form of the canonical
 * travel workspace gate (`requireTravelWorkplace`).
 *
 * It first enforces the minimum role, then resolves the authenticated
 * workspace's industry **directly from the database** (never from a
 * client-supplied value) and rejects with a 403 `ForbiddenError` when it is
 * not one of `allowedIndustries`.
 *
 * This is the single server-side enforcement point for the rule
 * "an industry-specific feature must only be reachable from a workspace of
 * that industry". Hiding navigation client-side is not sufficient — every
 * industry-scoped API route must call this (or a thin wrapper such as
 * {@link requireHealthWorkplace}) so that direct URL / API access is blocked
 * with a 403 regardless of the client.
 */
export async function requireIndustryWorkplace(
  allowedIndustries: CanonicalIndustry | readonly CanonicalIndustry[],
  minRole: AccountRole = 'viewer',
  featureLabel?: string
): Promise<ResolvedAccountContext> {
  const allowed = ([] as CanonicalIndustry[]).concat(allowedIndustries);

  const context = await requireRole(minRole);

  const rawIndustry = (context.account as { industry?: string })?.industry;
  if (rawIndustry) {
    if (!allowed.includes(resolveIndustryAlias(rawIndustry))) {
      throw new ForbiddenError(
        featureLabel
          ? `This feature is only available to ${featureLabel} workspaces`
          : 'This feature is not available for your workspace industry'
      );
    }
    return context;
  }

  if (context.admin?.from) {
    const { data: account, error } = await context.admin
      .from('accounts')
      .select('industry')
      .eq('id', context.accountId)
      .maybeSingle();

    if (error || !allowed.includes(resolveIndustryAlias(account?.industry))) {
      throw new ForbiddenError(
        featureLabel
          ? `This feature is only available to ${featureLabel} workspaces`
          : 'This feature is not available for your workspace industry'
      );
    }
  }

  return context;
}

/**
 * Health & Clinic-only guard. Wraps {@link requireIndustryWorkplace} for the
 * clinic operations surface (Patients, Doctors, Departments, Medical Reports).
 */
export async function requireHealthWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace(
    'hospital_clinic',
    minRole,
    'Health & Clinic'
  );
}

/**
 * Travel Agency-only guard.
 */
export async function requireTravelWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('travel', minRole, 'Travel Agency');
}

/**
 * Coaching Institute-only guard.
 */
export async function requireCoachingWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('coaching', minRole, 'Coaching Institute');
}

/**
 * Education / Coaching / Solo Teacher guard.
 */
export async function requireEducationWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace(
    ['coaching', 'solo_teacher'],
    minRole,
    'Education & Coaching'
  );
}

/**
 * Salon & Spa-only guard.
 */
export async function requireSalonWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('salon', minRole, 'Salon & Spa');
}

/**
 * Real Estate-only guard.
 */
export async function requireRealEstateWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('real_estate', minRole, 'Real Estate');
}

/**
 * Gym & Fitness-only guard.
 */
export async function requireGymWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('gym', minRole, 'Gym & Fitness');
}

/**
 * Restaurant-only guard.
 */
export async function requireRestaurantWorkplace(
  minRole: AccountRole = 'viewer'
): Promise<ResolvedAccountContext> {
  return requireIndustryWorkplace('restaurant', minRole, 'Restaurant');
}
