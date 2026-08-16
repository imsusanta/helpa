/**
 * Helpa Core SaaS Billing — Types & Interfaces
 */

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAUSED'
  | 'INCOMPLETE'
  | 'TRIAL_EXPIRED';

export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  trialDays: number;
  isActive: boolean;
  displayOrder: number;
  features: string[]; // Feature keys enabled for this plan
  usageLimits: {
    aiMessages: number; // e.g. 5000 (0 for unlimited)
    whatsappMessages: number; // e.g. 10000
    teamMembers: number; // e.g. 5
    campaignMessages: number; // e.g. 2000
    contacts: number; // e.g. 5000
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
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
  | 'automation';

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
  amount: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  provider: string;
  providerPaymentId: string;
  date: string;
  invoiceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingAuditEvent {
  id: string;
  actorEmail?: string;
  workspaceId: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
