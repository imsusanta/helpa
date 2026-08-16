/**
 * Helpa Core Super Admin — System Settings Service
 *
 * Platform-wide configurations, maintenance mode, and default parameters.
 */

import { SystemSettings } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { logAdminAction } from './audit.service';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultTrialDays: 14,
  defaultCurrency: 'INR',
  defaultTimezone: 'Asia/Kolkata',
  defaultAiModel: 'google/gemini-2.5-flash',
  usageWarningThreshold: 80,
  defaultGracePeriodDays: 3,
  maintenanceMode: false,
  newSignupEnabled: true,
  newIndustrySignupEnabled: true,
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const db = getAdminClient();
  const { data: row } = await db
    .from('system_settings')
    .select('*')
    .eq('id', 'platform_settings')
    .maybeSingle();

  if (!row) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  const s = (row.settings as Record<string, unknown>) || {};
  return {
    defaultTrialDays: Number(
      s.defaultTrialDays ?? DEFAULT_SYSTEM_SETTINGS.defaultTrialDays
    ),
    defaultCurrency: String(
      s.defaultCurrency || DEFAULT_SYSTEM_SETTINGS.defaultCurrency
    ),
    defaultTimezone: String(
      s.defaultTimezone || DEFAULT_SYSTEM_SETTINGS.defaultTimezone
    ),
    defaultAiModel: String(
      s.defaultAiModel || DEFAULT_SYSTEM_SETTINGS.defaultAiModel
    ),
    usageWarningThreshold: Number(
      s.usageWarningThreshold ?? DEFAULT_SYSTEM_SETTINGS.usageWarningThreshold
    ),
    defaultGracePeriodDays: Number(
      s.defaultGracePeriodDays ?? DEFAULT_SYSTEM_SETTINGS.defaultGracePeriodDays
    ),
    maintenanceMode: Boolean(
      s.maintenanceMode ?? DEFAULT_SYSTEM_SETTINGS.maintenanceMode
    ),
    newSignupEnabled: Boolean(
      s.newSignupEnabled ?? DEFAULT_SYSTEM_SETTINGS.newSignupEnabled
    ),
    newIndustrySignupEnabled: Boolean(
      s.newIndustrySignupEnabled ??
      DEFAULT_SYSTEM_SETTINGS.newIndustrySignupEnabled
    ),
  };
}

export async function updateSystemSettings(
  actorEmail: string,
  newSettings: Partial<SystemSettings>
): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated: SystemSettings = {
    ...current,
    ...newSettings,
  };

  const db = getAdminClient();
  await db.from('system_settings').upsert({
    id: 'platform_settings',
    settings: updated,
    updated_at: new Date().toISOString(),
  });

  await logAdminAction({
    actorEmail,
    action: 'system_settings:updated',
    targetType: 'system',
    targetId: 'platform_settings',
    metadata: { changedKeys: Object.keys(newSettings) },
  });

  return updated;
}
