/**
 * Helpa Core Super Admin — Types & Interfaces
 */

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  paidTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  totalWhatsAppAccounts: number;
  connectedWhatsAppAccounts: number;
  totalAiRequests: number;
  totalMessages: number;
  monthlyRevenue: number; // in INR
  mrr: number; // in INR
  arr: number; // in INR
  industryDistribution: Record<string, number>;
  planDistribution: Record<string, number>;
}

export type TenantAdminStatus =
  | 'Active'
  | 'Trial'
  | 'Suspended'
  | 'Cancelled'
  | 'Expired';

export interface TenantAdminView {
  id: string;
  name: string;
  industry: string;
  plan: string;
  subscriptionStatus: string;
  tenantStatus: TenantAdminStatus;
  ownerEmail?: string;
  ownerName?: string;
  membersCount: number;
  contactsCount: number;
  whatsAppStatus: 'Connected' | 'Disconnected' | 'Pending';
  whatsAppNumber?: string;
  wabaId?: string;
  phoneNumberId?: string;
  aiUsagePercent: number;
  whatsappUsagePercent: number;
  createdAt: string;
  lastActive: string;
}

export interface UserAdminView {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  industry: string;
  role: string;
  status: string;
  createdAt: string;
  lastActive?: string;
}

export interface SystemSettings {
  defaultTrialDays: number;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultAiModel: string;
  usageWarningThreshold: number;
  defaultGracePeriodDays: number;
  maintenanceMode: boolean;
  newSignupEnabled: boolean;
  newIndustrySignupEnabled: boolean;
}

export interface AdminAuditLog {
  id: string;
  actorEmail: string;
  action: string;
  targetType: 'tenant' | 'user' | 'plan' | 'feature' | 'system';
  targetId: string;
  workspaceId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
