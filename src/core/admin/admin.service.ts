/**
 * Helpa Core Super Admin — truthful platform management service.
 */

import type { PlatformMetrics, TenantAdminView, UserAdminView } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { logAdminAction } from './audit.service';

function assertDatabaseResult(
  error: { message?: string } | null | undefined,
  operation: string
): void {
  if (error) throw new Error(`${operation}: ${error.message || 'database error'}`);
}

function statusForTenant(
  suspended: boolean,
  subscriptionStatus: string
): TenantAdminView['tenantStatus'] {
  if (suspended) return 'Suspended';
  if (['TRIAL', 'TRIALING'].includes(subscriptionStatus)) return 'Trial';
  if (subscriptionStatus === 'CANCELLED') return 'Cancelled';
  if (subscriptionStatus === 'EXPIRED') return 'Expired';
  return 'Active';
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const database = getAdminClient();

  const [accountsResult, profilesResult, subscriptionsResult, whatsappResult, usageResult, messagesResult] =
    await Promise.all([
      database.from('accounts').select('*'),
      database.from('profiles').select('id'),
      database
        .from('subscriptions')
        .select('account_id, status, plan_slug, monthly_amount'),
      database.from('whatsapp_configs').select('account_id, status'),
      database.from('usage_records').select('account_id, metric, count'),
      database
        .from('messages')
        .select('id', { count: 'exact', head: true }),
    ]);

  assertDatabaseResult(accountsResult.error, 'Failed to load accounts');
  assertDatabaseResult(profilesResult.error, 'Failed to load profiles');
  assertDatabaseResult(
    subscriptionsResult.error,
    'Failed to load subscriptions'
  );
  assertDatabaseResult(whatsappResult.error, 'Failed to load WhatsApp accounts');
  assertDatabaseResult(usageResult.error, 'Failed to load usage records');
  assertDatabaseResult(messagesResult.error, 'Failed to count messages');

  const accounts = accountsResult.data || [];
  const profiles = profilesResult.data || [];
  const subscriptions = subscriptionsResult.data || [];
  const whatsappConfigs = whatsappResult.data || [];
  const usage = usageResult.data || [];

  const subscriptionByAccount = new Map(
    subscriptions.map((subscription) => [
      String(subscription.account_id),
      subscription,
    ])
  );

  let activeTenants = 0;
  let trialTenants = 0;
  let paidTenants = 0;
  let suspendedTenants = 0;
  let pastDueSubscriptions = 0;
  let mrr = 0;
  const industryDistribution: Record<string, number> = {};
  const planDistribution: Record<string, number> = {};

  for (const account of accounts) {
    const accountId = String(account.id);
    const subscription = subscriptionByAccount.get(accountId);
    const subscriptionStatus = String(
      subscription?.status || account.subscription_status || 'INCOMPLETE'
    ).toUpperCase();
    const suspended =
      account.is_suspended === true ||
      String(account.status || '').toUpperCase() === 'SUSPENDED';

    if (suspended) suspendedTenants++;
    else if (subscriptionStatus === 'ACTIVE') {
      activeTenants++;
      paidTenants++;
    } else if (['TRIAL', 'TRIALING'].includes(subscriptionStatus)) {
      activeTenants++;
      trialTenants++;
    }

    if (subscriptionStatus === 'PAST_DUE') pastDueSubscriptions++;

    const industry = String(account.industry || 'general');
    industryDistribution[industry] = (industryDistribution[industry] || 0) + 1;
  }

  for (const subscription of subscriptions) {
    const plan = String(subscription.plan_slug || 'unassigned');
    planDistribution[plan] = (planDistribution[plan] || 0) + 1;

    if (String(subscription.status).toUpperCase() === 'ACTIVE') {
      const monthlyAmount = Number(subscription.monthly_amount || 0);
      if (Number.isFinite(monthlyAmount) && monthlyAmount > 0) {
        mrr += monthlyAmount;
      }
    }
  }

  const totalAiRequests = usage.reduce((total, record) => {
    const metric = String(record.metric || '').toLowerCase();
    if (!['ai_responses', 'ai_queries', 'ai_requests'].includes(metric)) {
      return total;
    }
    const count = Number(record.count || 0);
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);

  return {
    totalTenants: accounts.length,
    activeTenants,
    trialTenants,
    paidTenants,
    suspendedTenants,
    totalUsers: profiles.length,
    activeSubscriptions: paidTenants + trialTenants,
    pastDueSubscriptions,
    totalWhatsAppAccounts: whatsappConfigs.length,
    connectedWhatsAppAccounts: whatsappConfigs.filter((config) =>
      ['CONNECTED', 'ACTIVE'].includes(String(config.status || '').toUpperCase())
    ).length,
    totalAiRequests,
    totalMessages: messagesResult.count ?? messagesResult.data?.length ?? 0,
    monthlyRevenue: mrr,
    mrr,
    arr: mrr * 12,
    industryDistribution,
    planDistribution,
  };
}

export async function listAllTenants(filter?: {
  search?: string;
  industry?: string;
  plan?: string;
  status?: string;
}): Promise<TenantAdminView[]> {
  const database = getAdminClient();
  const [accountsResult, profilesResult, subscriptionsResult, contactsResult, whatsappResult] =
    await Promise.all([
      database.from('accounts').select('*'),
      database.from('profiles').select('*'),
      database.from('subscriptions').select('*'),
      database.from('contacts').select('id, account_id'),
      database.from('whatsapp_configs').select('*'),
    ]);

  assertDatabaseResult(accountsResult.error, 'Failed to load accounts');
  assertDatabaseResult(profilesResult.error, 'Failed to load profiles');
  assertDatabaseResult(
    subscriptionsResult.error,
    'Failed to load subscriptions'
  );
  assertDatabaseResult(contactsResult.error, 'Failed to load contacts');
  assertDatabaseResult(whatsappResult.error, 'Failed to load WhatsApp configs');

  const profiles = profilesResult.data || [];
  const subscriptions = subscriptionsResult.data || [];
  const contacts = contactsResult.data || [];
  const whatsappConfigs = whatsappResult.data || [];

  let tenants = (accountsResult.data || []).map((account) => {
    const accountId = String(account.id);
    const accountProfiles = profiles.filter(
      (profile) => String(profile.account_id || '') === accountId
    );
    const owner =
      accountProfiles.find(
        (profile) =>
          String(profile.user_id || profile.id) ===
          String(account.owner_user_id || '')
      ) ||
      accountProfiles.find((profile) =>
        ['owner', 'admin'].includes(
          String(profile.account_role || profile.role || '').toLowerCase()
        )
      );
    const subscription = subscriptions.find(
      (item) => String(item.account_id || '') === accountId
    );
    const whatsapp = whatsappConfigs.find(
      (item) => String(item.account_id || '') === accountId
    );
    const subscriptionStatus = String(
      subscription?.status || account.subscription_status || 'INCOMPLETE'
    ).toUpperCase();
    const suspended =
      account.is_suspended === true ||
      String(account.status || '').toUpperCase() === 'SUSPENDED';
    const whatsappStatus = String(whatsapp?.status || '').toUpperCase();

    return {
      id: accountId,
      name: String(account.name || accountId),
      industry: String(account.industry || 'general'),
      plan: String(
        subscription?.plan_slug || account.subscription_plan || 'unassigned'
      ),
      subscriptionStatus,
      tenantStatus: statusForTenant(suspended, subscriptionStatus),
      ownerEmail: owner?.email ? String(owner.email) : undefined,
      ownerName: owner
        ? String(owner.full_name || owner.name || '') || undefined
        : undefined,
      membersCount: accountProfiles.length,
      contactsCount: contacts.filter(
        (contact) => String(contact.account_id || '') === accountId
      ).length,
      whatsAppStatus: ['CONNECTED', 'ACTIVE'].includes(whatsappStatus)
        ? ('Connected' as const)
        : whatsapp
          ? ('Pending' as const)
          : ('Disconnected' as const),
      whatsAppNumber: whatsapp?.display_phone_number
        ? String(whatsapp.display_phone_number)
        : whatsapp?.phone_number
          ? String(whatsapp.phone_number)
          : undefined,
      wabaId: whatsapp?.waba_id ? String(whatsapp.waba_id) : undefined,
      phoneNumberId: whatsapp?.phone_number_id
        ? String(whatsapp.phone_number_id)
        : undefined,
      aiUsagePercent: 0,
      whatsappUsagePercent: 0,
      createdAt: String(account.created_at || ''),
      lastActive: String(account.updated_at || account.created_at || ''),
    } satisfies TenantAdminView;
  });

  if (filter?.search?.trim()) {
    const query = filter.search.trim().toLowerCase();
    tenants = tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(query) ||
        tenant.id.toLowerCase().includes(query) ||
        tenant.ownerEmail?.toLowerCase().includes(query)
    );
  }
  if (filter?.industry?.trim()) {
    const industry = filter.industry.trim().toLowerCase();
    tenants = tenants.filter(
      (tenant) => tenant.industry.toLowerCase() === industry
    );
  }
  if (filter?.plan?.trim()) {
    const plan = filter.plan.trim().toLowerCase();
    tenants = tenants.filter((tenant) => tenant.plan.toLowerCase() === plan);
  }
  if (filter?.status?.trim()) {
    const status = filter.status.trim().toLowerCase();
    tenants = tenants.filter(
      (tenant) => tenant.tenantStatus.toLowerCase() === status
    );
  }

  return tenants;
}

async function requireAccount(workspaceId: string): Promise<void> {
  const { data, error } = await getAdminClient()
    .from('accounts')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle();
  assertDatabaseResult(error, 'Failed to verify tenant');
  if (!data) throw new Error('Tenant not found');
}

export async function suspendTenant({
  actorEmail,
  workspaceId,
  reason,
}: {
  actorEmail: string;
  workspaceId: string;
  reason?: string;
}): Promise<boolean> {
  await requireAccount(workspaceId);
  const { error } = await getAdminClient()
    .from('accounts')
    .update({
      is_suspended: true,
      status: 'SUSPENDED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);
  assertDatabaseResult(error, 'Failed to suspend tenant');

  await logAdminAction({
    actorEmail,
    action: 'tenant:suspended',
    targetType: 'tenant',
    targetId: workspaceId,
    workspaceId,
    metadata: { reason },
  });
  return true;
}

export async function reactivateTenant({
  actorEmail,
  workspaceId,
}: {
  actorEmail: string;
  workspaceId: string;
}): Promise<boolean> {
  await requireAccount(workspaceId);
  const { error } = await getAdminClient()
    .from('accounts')
    .update({
      is_suspended: false,
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);
  assertDatabaseResult(error, 'Failed to reactivate tenant');

  await logAdminAction({
    actorEmail,
    action: 'tenant:reactivated',
    targetType: 'tenant',
    targetId: workspaceId,
    workspaceId,
  });
  return true;
}

export async function extendTenantTrial({
  actorEmail,
  workspaceId,
  additionalDays = 7,
  reason,
}: {
  actorEmail: string;
  workspaceId: string;
  additionalDays?: number;
  reason?: string;
}): Promise<{ trialEnd: string }> {
  if (!Number.isInteger(additionalDays) || additionalDays < 1 || additionalDays > 365) {
    throw new Error('Trial extension must be between 1 and 365 days');
  }
  await requireAccount(workspaceId);

  const database = getAdminClient();
  const { data: subscription, error: lookupError } = await database
    .from('subscriptions')
    .select('id, end_date')
    .eq('account_id', workspaceId)
    .maybeSingle();
  assertDatabaseResult(lookupError, 'Failed to load subscription');
  if (!subscription) throw new Error('Subscription not found');

  const currentEnd = subscription.end_date
    ? new Date(subscription.end_date).getTime()
    : 0;
  const base = Math.max(Date.now(), Number.isFinite(currentEnd) ? currentEnd : 0);
  const trialEnd = new Date(base + additionalDays * 86400 * 1000).toISOString();

  const { error } = await database
    .from('subscriptions')
    .update({
      status: 'TRIALING',
      end_date: trialEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
    .eq('account_id', workspaceId);
  assertDatabaseResult(error, 'Failed to extend trial');

  await logAdminAction({
    actorEmail,
    action: 'trial:extended',
    targetType: 'tenant',
    targetId: workspaceId,
    workspaceId,
    metadata: { additionalDays, trialEnd, reason },
  });
  return { trialEnd };
}

export async function listAllUsers(): Promise<UserAdminView[]> {
  const database = getAdminClient();
  const [profilesResult, accountsResult] = await Promise.all([
    database.from('profiles').select('*'),
    database.from('accounts').select('id, name, industry'),
  ]);
  assertDatabaseResult(profilesResult.error, 'Failed to load users');
  assertDatabaseResult(accountsResult.error, 'Failed to load accounts');

  const accounts = new Map(
    (accountsResult.data || []).map((account) => [String(account.id), account])
  );

  return (profilesResult.data || []).map((profile) => {
    const workspaceId = String(profile.account_id || '');
    const account = accounts.get(workspaceId);
    return {
      id: String(profile.id || profile.user_id || ''),
      name: String(profile.full_name || profile.name || ''),
      email: String(profile.email || ''),
      workspaceId,
      workspaceName: String(account?.name || ''),
      industry: String(account?.industry || 'general'),
      role: String(
        profile.is_super_admin
          ? 'super_admin'
          : profile.account_role || profile.role || 'member'
      ),
      status: String(profile.status || 'Active'),
      createdAt: String(profile.created_at || ''),
      lastActive: profile.updated_at ? String(profile.updated_at) : undefined,
    };
  });
}
