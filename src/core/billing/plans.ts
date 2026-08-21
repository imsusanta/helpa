/**
 * Helpa Core SaaS Billing — Official Plans Catalog & Management
 */

import { SubscriptionPlan } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';

export class PlanNotFoundError extends Error {
  readonly code = 'PLAN_NOT_FOUND';

  constructor(readonly identifier: string) {
    super(`Subscription plan '${identifier}' was not found.`);
    this.name = 'PlanNotFoundError';
  }
}

/**
 * Explicit aliases retained for subscriptions created before the current
 * Starter/Growth/Pro catalog. Unknown identifiers are never assigned a plan.
 */
const LEGACY_PLAN_ALIASES: Readonly<Record<string, string>> = {
  starter: 'starter',
  plan_starter: 'starter',
  growth: 'growth',
  plan_growth: 'growth',
  professional: 'growth',
  plan_professional: 'growth',
  pro: 'pro',
  plan_pro: 'pro',
  business: 'pro',
  plan_business: 'pro',
  enterprise: 'pro',
  plan_enterprise: 'pro',
};

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    slug: 'starter',
    description:
      'For growing businesses requiring AI-powered appointment & lead communication.',
    setupFee: 7999,
    monthlyPrice: 3499,
    yearlyPrice: 34990,
    currency: 'INR',
    billingInterval: 'monthly',
    isRecommended: false,
    isActive: true,
    displayOrder: 1,
    features: [
      'core.inbox',
      'core.contacts',
      'core.ai',
      'core.knowledge_base',
      'core.campaigns',
      'health.patients',
      'health.doctors',
      'health.appointments',
      'coaching.students',
      'coaching.courses',
      'tutor.students',
      'salon.customers',
      'realestate.leads',
    ],
    usageLimits: {
      aiMessages: 1500,
      whatsappMessages: 3000,
      teamMembers: 3,
      campaignMessages: 1000,
      contacts: 1500,
      automations: 5,
      knowledgeBaseMb: 25,
      appointments: 250,
      storageMb: 500,
    },
  },
  {
    id: 'plan_growth',
    name: 'Growth ⭐',
    slug: 'growth',
    description:
      'Recommended plan for clinics, institutes, and agencies needing Copilot & Automations.',
    setupFee: 11999,
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    billingInterval: 'monthly',
    isRecommended: true,
    isActive: true,
    displayOrder: 2,
    features: [
      'core.inbox',
      'core.contacts',
      'core.ai',
      'core.knowledge_base',
      'core.campaigns',
      'core.automations',
      'core.ai_copilot',
      'core.analytics',
      'health.patients',
      'health.doctors',
      'health.appointments',
      'health.report_status',
      'coaching.students',
      'coaching.courses',
      'coaching.batches',
      'coaching.admissions',
      'tutor.students',
      'tutor.assignments',
      'tutor.class_reminders',
      'salon.customers',
      'salon.services',
      'salon.staff',
      'salon.appointments',
      'realestate.leads',
      'realestate.properties',
      'realestate.matching',
      'realestate.site_visits',
    ],
    usageLimits: {
      aiMessages: 5000,
      whatsappMessages: 10000,
      teamMembers: 10,
      campaignMessages: 5000,
      contacts: 10000,
      automations: 25,
      knowledgeBaseMb: 100,
      appointments: 1000,
      storageMb: 2000,
    },
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    slug: 'pro',
    description:
      'High-scale multi-agent operations, custom models, and unlimited capacity.',
    setupFee: 19999,
    monthlyPrice: 7999,
    yearlyPrice: 79990,
    currency: 'INR',
    billingInterval: 'monthly',
    isRecommended: false,
    isActive: true,
    displayOrder: 3,
    features: [
      'core.inbox',
      'core.contacts',
      'core.ai',
      'core.knowledge_base',
      'core.campaigns',
      'core.automations',
      'core.ai_copilot',
      'core.analytics',
      'health.patients',
      'health.doctors',
      'health.appointments',
      'health.report_status',
      'coaching.students',
      'coaching.courses',
      'coaching.batches',
      'coaching.admissions',
      'tutor.students',
      'tutor.assignments',
      'tutor.class_reminders',
      'salon.customers',
      'salon.services',
      'salon.staff',
      'salon.appointments',
      'realestate.leads',
      'realestate.properties',
      'realestate.matching',
      'realestate.site_visits',
      'core.custom_models',
      'core.dedicated_support',
    ],
    usageLimits: {
      aiMessages: 25000,
      whatsappMessages: 50000,
      teamMembers: 25,
      campaignMessages: 25000,
      contacts: 50000,
      automations: 100,
      knowledgeBaseMb: 500,
      appointments: 5000,
      storageMb: 10000,
    },
  },
];

function parseFeatures(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
      ) {
        return parsed;
      }
    } catch {
      // A malformed catalog row must not break the complete pricing catalog.
    }
  }

  return fallback;
}

function resolvePlanLookup(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return LEGACY_PLAN_ALIASES[normalized] || normalized;
}

export async function getAvailablePlans(): Promise<SubscriptionPlan[]> {
  try {
    const db = getAdminClient();
    const { data: rows, error } = await db
      .from('plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error || !rows || rows.length === 0) {
      return DEFAULT_PLANS;
    }

    return rows.map((r) => {
      const slug =
        r.slug ||
        String(r.id || r.name)
          .toLowerCase()
          .replace(/^plan_/, '');
      const defaultPlan = DEFAULT_PLANS.find(
        (plan) => plan.slug === slug || plan.id === r.id
      );

      return {
        id: r.id || defaultPlan?.id || `plan_${slug}`,
        name: r.name || defaultPlan?.name || 'Plan',
        slug: slug as 'starter' | 'growth' | 'pro',
        description: r.description || defaultPlan?.description || '',
        setupFee: Number(r.setup_fee ?? defaultPlan?.setupFee ?? 0),
        monthlyPrice: Number(
          r.monthly_price ?? defaultPlan?.monthlyPrice ?? 0
        ),
        yearlyPrice: Number(r.yearly_price ?? defaultPlan?.yearlyPrice ?? 0),
        currency: r.currency || 'INR',
        billingInterval:
          (r.billing_interval as 'monthly' | 'yearly') || 'monthly',
        isRecommended: r.is_recommended ?? defaultPlan?.isRecommended ?? false,
        isActive: r.is_active !== false,
        displayOrder: Number(
          r.display_order || defaultPlan?.displayOrder || 1
        ),
        features: parseFeatures(r.features, defaultPlan?.features || []),
        usageLimits: {
          aiMessages: Number(
            r.max_ai_requests ??
              r.ai_messages ??
              defaultPlan?.usageLimits.aiMessages ??
              5000
          ),
          whatsappMessages: Number(
            r.max_whatsapp_messages ??
              r.whatsapp_messages ??
              defaultPlan?.usageLimits.whatsappMessages ??
              10000
          ),
          teamMembers: Number(
            r.max_users ??
              r.team_members ??
              defaultPlan?.usageLimits.teamMembers ??
              5
          ),
          campaignMessages: Number(
            r.campaign_messages ??
              defaultPlan?.usageLimits.campaignMessages ??
              2000
          ),
          contacts: Number(
            r.max_contacts ??
              r.contacts ??
              defaultPlan?.usageLimits.contacts ??
              5000
          ),
          automations: Number(
            r.automations ?? defaultPlan?.usageLimits.automations ?? 25
          ),
          knowledgeBaseMb: Number(
            r.knowledge_base_mb ??
              defaultPlan?.usageLimits.knowledgeBaseMb ??
              100
          ),
          appointments: Number(
            r.appointments ?? defaultPlan?.usageLimits.appointments ?? 1000
          ),
          storageMb: Number(
            r.storage_mb ?? defaultPlan?.usageLimits.storageMb ?? 2000
          ),
        },
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  } catch (error) {
    console.warn(
      '[getAvailablePlans] DB fetch failed; using display catalog defaults:',
      error
    );
    return DEFAULT_PLANS;
  }
}

/** Returns null for an unknown identifier; intended for user-provided input. */
export async function findPlanBySlug(
  identifier: string
): Promise<SubscriptionPlan | null> {
  if (!identifier?.trim()) return null;

  const plans = await getAvailablePlans();
  const lookup = resolvePlanLookup(identifier);

  return (
    plans.find(
      (plan) =>
        plan.slug.toLowerCase() === lookup ||
        plan.id.toLowerCase() === lookup ||
        plan.id.toLowerCase() === `plan_${lookup}`
    ) || null
  );
}

/**
 * Strict lookup for authorization and billing flows. Unknown identifiers fail
 * closed instead of silently receiving the Growth plan.
 */
export async function getPlanBySlug(slug: string): Promise<SubscriptionPlan> {
  const plan = await findPlanBySlug(slug);
  if (!plan) throw new PlanNotFoundError(slug);
  return plan;
}

export async function getPlanById(planId: string): Promise<SubscriptionPlan> {
  return getPlanBySlug(planId);
}
