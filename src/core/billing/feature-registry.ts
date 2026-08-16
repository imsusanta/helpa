/**
 * Helpa Core SaaS Billing — Feature Registry & Access Gating
 *
 * Centralized feature resolution: verifies subscription status, plan entitlements,
 * and industry boundaries.
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
  'TRIALING',
  'PAST_DUE', // In grace period
];

/**
 * Checks if a workspace is entitled to use a specific feature key based on
 * its industry, subscription status, and plan configuration.
 */
export async function canAccessFeature(
  workspace: WorkspaceContextForFeature,
  featureKey: string
): Promise<FeatureAccessResult> {
  // 1. Subscription status validation
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(workspace.subscriptionStatus)) {
    return {
      allowed: false,
      featureKey,
      reason: `Subscription is ${workspace.subscriptionStatus.toLowerCase()}. Upgrade or renew your plan to restore access.`,
    };
  }

  // 2. Industry scope validation (cross-industry feature isolation)
  const [featureDomain] = featureKey.split('.');
  if (featureDomain !== 'core') {
    const normalizedIndustry = workspace.industry.toLowerCase().replace(/[\s_-]+/g, '');
    const normalizedDomain = featureDomain.toLowerCase().replace(/[\s_-]+/g, '');

    const isMatch =
      normalizedIndustry.includes(normalizedDomain) ||
      normalizedDomain.includes(normalizedIndustry) ||
      (normalizedIndustry.includes('tutor') && normalizedDomain.includes('tutor')) ||
      (normalizedIndustry.includes('teacher') && normalizedDomain.includes('tutor'));

    if (!isMatch) {
      return {
        allowed: false,
        featureKey,
        reason: `Feature '${featureKey}' is not supported in the ${workspace.industry} workspace.`,
      };
    }
  }

  // 3. Plan feature entitlement check
  const plan = await getPlanById(workspace.subscriptionPlanId);
  const isFeatureInPlan =
    plan.features.includes(featureKey) ||
    plan.features.includes(`${featureDomain}.*`) ||
    plan.features.includes('*');

  if (!isFeatureInPlan) {
    return {
      allowed: false,
      featureKey,
      requiredPlan: 'Professional',
      reason: `Feature '${featureKey}' requires upgrading to Professional or Business plan.`,
    };
  }

  return {
    allowed: true,
    featureKey,
  };
}
