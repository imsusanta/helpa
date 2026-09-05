/**
 * Helpa Core SaaS Billing — Feature Registry & Access Gating
 */

import { FeatureAccessResult, SubscriptionStatus } from './types';
import { getPlanById } from './plans';

export interface WorkspaceContextForFeature {
  id: string;
  industry: string;
  subscriptionPlanId: string;
  subscriptionStatus: SubscriptionStatus;
}

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'ACTIVE',
  'TRIAL',
  'TRIALING',
  'PAST_DUE',
];

const INDUSTRY_FEATURE_DOMAINS: Readonly<Record<string, string>> = {
  health: 'health',
  hospital: 'health',
  clinic: 'health',
  healthcare: 'health',
  hospitalclinic: 'health',
  coaching: 'coaching',
  education: 'coaching',
  institute: 'coaching',
  tutor: 'tutor',
  teacher: 'tutor',
  soloteacher: 'tutor',
  salon: 'salon',
  spa: 'salon',
  beauty: 'salon',
  realestate: 'realestate',
  property: 'realestate',
  travel: 'travel',
  gym: 'gym',
  fitness: 'gym',
  restaurant: 'restaurant',
  cafe: 'restaurant',
  general: 'general',
};

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function resolveIndustryFeatureDomain(industry: string): string {
  const normalized = normalizeIdentifier(industry);
  return INDUSTRY_FEATURE_DOMAINS[normalized] || normalized;
}

function parseFeatureDomain(featureKey: string): string | null {
  const [domain, feature, ...extra] = featureKey.trim().toLowerCase().split('.');
  if (!domain || !feature || extra.length > 0) return null;
  if (!/^[a-z][a-z0-9_-]*$/.test(domain)) return null;
  if (!/^[a-z][a-z0-9_-]*$/.test(feature)) return null;
  return normalizeIdentifier(domain);
}

/**
 * Checks subscription status, exact industry domain, and plan entitlement.
 * Every lookup failure denies access rather than granting a fallback plan.
 */
export async function canAccessFeature(
  workspace: WorkspaceContextForFeature,
  featureKey: string
): Promise<FeatureAccessResult> {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(workspace.subscriptionStatus)) {
    return {
      allowed: false,
      featureKey,
      reason: `Subscription is ${workspace.subscriptionStatus.toLowerCase()}. Upgrade or renew your plan to restore access.`,
    };
  }

  const featureDomain = parseFeatureDomain(featureKey);
  if (!featureDomain) {
    return {
      allowed: false,
      featureKey,
      reason: 'Invalid feature identifier.',
    };
  }

  if (featureDomain !== 'core') {
    const industryDomain = resolveIndustryFeatureDomain(workspace.industry);
    if (industryDomain !== featureDomain) {
      return {
        allowed: false,
        featureKey,
        reason: `Feature '${featureKey}' is not supported in the ${workspace.industry} workspace.`,
      };
    }
  }

  try {
    const plan = await getPlanById(workspace.subscriptionPlanId);
    if (!plan.isActive) {
      return {
        allowed: false,
        featureKey,
        reason: `Subscription plan '${plan.name}' is inactive.`,
      };
    }

    const isFeatureInPlan =
      plan.features.includes(featureKey) ||
      plan.features.includes(`${featureDomain}.*`) ||
      plan.features.includes('*');

    if (!isFeatureInPlan) {
      return {
        allowed: false,
        featureKey,
        requiredPlan: 'Professional',
        reason: `Feature '${featureKey}' requires a plan that includes it.`,
      };
    }

    return { allowed: true, featureKey };
  } catch {
    return {
      allowed: false,
      featureKey,
      reason: 'Feature entitlement could not be verified.',
    };
  }
}
