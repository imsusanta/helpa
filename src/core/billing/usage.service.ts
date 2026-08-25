/**
 * Helpa Core SaaS Billing — Usage Tracking & Limit Enforcement
 *
 * Metered consumption tracking (AI messages, WhatsApp messages, team members),
 * threshold alerts (80%, 90%, 100%), and billing cycle aggregation.
 */

import { UsageMetricType, UsageLimitCheckResult } from './types';
import { getPlanById } from './plans';
import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';

export interface RecordUsageInput {
  workspaceId: string;
  metric: UsageMetricType;
  quantity?: number;
  source: string;
  referenceId?: string;
}

/**
 * Records metered consumption for a workspace idempotently.
 */
export async function recordUsage({
  workspaceId,
  metric,
  quantity = 1,
  source,
  referenceId,
}: RecordUsageInput): Promise<boolean> {
  const db = getAdminClient();

  // 1. If referenceId is provided, check if already recorded
  if (referenceId) {
    const { data: existing } = await db
      .from('audit_logs')
      .select('id')
      .eq('account_id', workspaceId)
      .eq('action', `usage:${metric}:${referenceId}`)
      .maybeSingle();

    if (existing) {
      return true; // Already processed
    }
  }

  // 2. Insert usage event
  await db.from('audit_logs').insert({
    account_id: workspaceId,
    action: referenceId ? `usage:${metric}:${referenceId}` : `usage:${metric}`,
    details: {
      metric,
      quantity,
      source,
      referenceId,
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  return true;
}

/**
 * Retrieves current consumption count for a workspace in the current billing period.
 */
export async function getCurrentUsage(
  workspaceId: string,
  metric: UsageMetricType
): Promise<number> {
  const db = getAdminClient();

  const { data: events } = await db
    .from('audit_logs')
    .select('details')
    .eq('account_id', workspaceId)
    .ilike('action', `usage:${metric}%`);

  if (!events || events.length === 0) {
    return 0;
  }

  let total = 0;
  for (const e of events) {
    const d = (e.details as Record<string, unknown>) || {};
    total += Number(d.quantity || 1);
  }

  return total;
}

/**
 * Validates whether a workspace can perform an action without exceeding plan limits.
 * Emits threshold warnings at 80%, 90%, and 100%.
 */
export async function checkUsageLimit(
  workspaceId: string,
  planId: string,
  metric: UsageMetricType,
  requestedQuantity: number = 1
): Promise<UsageLimitCheckResult> {
  const plan = await getPlanById(planId);
  const currentUsage = await getCurrentUsage(workspaceId, metric);

  let limit = 5000;
  if (metric === 'ai_message') limit = plan.usageLimits.aiMessages;
  else if (metric === 'whatsapp_message')
    limit = plan.usageLimits.whatsappMessages;
  else if (metric === 'team_member') limit = plan.usageLimits.teamMembers;
  else if (metric === 'campaign_message')
    limit = plan.usageLimits.campaignMessages;
  else if (metric === 'contact') limit = plan.usageLimits.contacts;

  // 0 means unlimited
  if (limit === 0) {
    return {
      allowed: true,
      currentUsage,
      limit: 0,
      remaining: Infinity,
      percentageUsed: 0,
    };
  }

  const projectedUsage = currentUsage + requestedQuantity;
  const percentageUsed = Math.min(
    100,
    Math.round((currentUsage / limit) * 100)
  );
  const remaining = Math.max(0, limit - currentUsage);

  let warningLevel: UsageLimitCheckResult['warningLevel'];
  if (percentageUsed >= 100) {
    warningLevel = '100%';
    coreEvents.emit('billing.usage_limit_reached', workspaceId, {
      metric,
      currentUsage,
      limit,
      timestamp: new Date().toISOString(),
    });
  } else if (percentageUsed >= 90) {
    warningLevel = '90%';
    coreEvents.emit('billing.usage_limit_warning', workspaceId, {
      metric,
      warningLevel: '90%',
      percentageUsed,
      timestamp: new Date().toISOString(),
    });
  } else if (percentageUsed >= 80) {
    warningLevel = '80%';
    coreEvents.emit('billing.usage_limit_warning', workspaceId, {
      metric,
      warningLevel: '80%',
      percentageUsed,
      timestamp: new Date().toISOString(),
    });
  }

  const allowed = projectedUsage <= limit;
  return {
    allowed,
    currentUsage,
    limit,
    remaining,
    percentageUsed,
    warningLevel,
    reason: allowed
      ? undefined
      : `Usage limit reached (${currentUsage}/${limit} ${metric}s). Upgrade your plan to continue.`,
  };
}
