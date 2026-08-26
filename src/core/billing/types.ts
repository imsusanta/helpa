/**
 * Helpa Core SaaS Billing — Types & Interfaces
 */

export type SubscriptionStatus =
  | 'TRIAL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TRIALING'
  | 'INCOMPLETE'
  | 'TRIAL_EXPIRED';

export type BillingInterval = 'monthly' | 'yearly';
export type BillingCycle = BillingInterval;

export interface PlanUsageLimits {
  aiMessages: number;
  whatsappMessages: number;
  teamMembers: number;
  campaignMessages: number;
  contacts: number;
  automations?: number;
  knowledgeBaseMb?: number;
  appointments?: number;
  storageMb?: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: 'starter' | 'growth' | 'pro' | string;
  description: string;
  setupFee: number;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: 'INR' | string;
  billingInterval: BillingInterval;
  trialDays?: number;
  isRecommended: boolean;
  isActive: boolean;
  displayOrder: number;
  features: string[]; // Feature keys enabled for this plan
  usageLimits: PlanUsageLimits;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  planId: string;
  planSlug?: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  setupFeePaid?: boolean;
  setupFeeAmount?: number;
  monthlyAmount?: number;
  currency?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  /** PAST_DUE keeps access only until this instant (see hasPaidAccess). */
  gracePeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  paymentProvider: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type UsageMetricType =
  | 'ai_message'
  | 'whatsapp_message'
  | 'ai_token'
  | 'campaign_message'
  | 'contact'
  | 'team_member'
  | 'automation'
  | 'ai_requests'
  | 'whatsapp_messages';

export interface UsageEvent {
  id: string;
  workspaceId: string;
  subscriptionId?: string;
  metric: UsageMetricType;
  quantity: number;
  source: string; // e.g. "whatsapp_ai", "campaign", "manual_import"
  referenceId?: string;
  createdAt: string;
}

export interface UsageLimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  warningLevel?: '80%' | '90%' | '100%';
  reason?: string;
}

export interface FeatureAccessResult {
  allowed: boolean;
  featureKey: string;
  requiredPlan?: string;
  reason?: string;
}

export interface PaymentRecord {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber?: string;
  description?: string;
  setupFee?: number;
  monthlySubscription?: number;
  amount: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  provider: string;
  providerPaymentId: string;
  date: string;
  invoiceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  setupFeeRevenue: number;
  recurringRevenue: number;
  monthlyRecurringRevenue: number;
  activeSubscriptionsCount: number;
  trialCustomersCount: number;
  pastDueCount: number;
  cancelledCount: number;
  revenueByPlan: {
    starter: number;
    growth: number;
    pro: number;
    [key: string]: number;
  };
  customerCountByPlan: {
    starter: number;
    growth: number;
    pro: number;
    [key: string]: number;
  };
  upgradeRate: number;
  cancellationRate: number;
}

export interface BillingAuditEvent {
  id: string;
  actorEmail?: string;
  workspaceId: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
