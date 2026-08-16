/**
 * Helpa Core SaaS Billing — Plans Catalog & Management
 */

import { SubscriptionPlan } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    name: 'Free',
    description:
      'Essential communication tools for solo businesses and evaluation.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    trialDays: 0,
    isActive: true,
    displayOrder: 1,
    features: [
      'core.inbox',
      'core.contacts',
      'core.ai',
      'health.patients',
      'coaching.students',
      'tutor.students',
      'salon.customers',
      'realestate.leads',
    ],
    usageLimits: {
      aiMessages: 100,
      whatsappMessages: 500,
      teamMembers: 1,
      campaignMessages: 100,
      contacts: 250,
    },
  },
  {
    id: 'plan_starter',
    name: 'Starter',
    description:
      'For growing businesses requiring AI-powered appointment & lead communication.',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: 'INR',
    trialDays: 14,
    isActive: true,
    displayOrder: 2,
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
      'coaching.batches',
      'tutor.students',
      'tutor.assignments',
      'tutor.class_reminders',
      'salon.customers',
      'salon.services',
      'salon.appointments',
      'realestate.leads',
      'realestate.properties',
    ],
    usageLimits: {
      aiMessages: 1500,
      whatsappMessages: 3000,
      teamMembers: 3,
      campaignMessages: 1000,
      contacts: 1500,
    },
  },
  {
    id: 'plan_professional',
    name: 'Professional',
    description:
      'Full-featured AI automation, AI Copilot, and high-volume WhatsApp communication.',
    monthlyPrice: 2499,
    yearlyPrice: 24990,
    currency: 'INR',
    trialDays: 14,
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
    ],
    usageLimits: {
      aiMessages: 5000,
      whatsappMessages: 10000,
      teamMembers: 10,
      campaignMessages: 5000,
      contacts: 10000,
    },
  },
  {
    id: 'plan_business',
    name: 'Business',
    description:
      'High-scale multi-agent operations, custom models, and priority support.',
    monthlyPrice: 5999,
    yearlyPrice: 59990,
    currency: 'INR',
    trialDays: 14,
    isActive: true,
    displayOrder: 4,
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
    ],
    usageLimits: {
      aiMessages: 20000,
      whatsappMessages: 35000,
      teamMembers: 25,
      campaignMessages: 20000,
      contacts: 50000,
    },
  },
];

export async function getAvailablePlans(): Promise<SubscriptionPlan[]> {
  const db = getAdminClient();
  const { data: rows } = await db
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (!rows || rows.length === 0) {
    return DEFAULT_PLANS;
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    monthlyPrice: Number(r.monthly_price || 0),
    yearlyPrice: Number(r.yearly_price || 0),
    currency: r.currency || 'INR',
    trialDays: Number(r.trial_days || 14),
    isActive: r.is_active !== false,
    displayOrder: Number(r.display_order || 1),
    features: (r.features as string[]) || [],
    usageLimits: {
      aiMessages: Number(r.max_ai_requests || r.ai_messages || 5000),
      whatsappMessages: Number(
        r.max_whatsapp_numbers || r.whatsapp_messages || 10000
      ),
      teamMembers: Number(r.max_users || r.team_members || 5),
      campaignMessages: Number(r.campaign_messages || 2000),
      contacts: Number(r.max_contacts || r.contacts || 5000),
    },
  }));
}

export async function getPlanById(planId: string): Promise<SubscriptionPlan> {
  const plans = await getAvailablePlans();
  const found = plans.find((p) => p.id.toLowerCase() === planId.toLowerCase());
  return found || DEFAULT_PLANS[2]; // Default to Professional if not found
}
