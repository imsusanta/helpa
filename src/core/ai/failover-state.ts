/**
 * Shared AI provider failover state.
 *
 * The state is intentionally kept in system_settings so cooldowns survive
 * serverless instance restarts. Secrets are never stored here.
 */
import { getAdminClient } from '@/lib/db/server';

export type ProviderCooldowns = Record<string, number>;

const COOLDOWN_KEY = 'system_ai_provider_cooldowns';

export async function loadProviderCooldowns(): Promise<ProviderCooldowns> {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', COOLDOWN_KEY)
      .maybeSingle();
    if (!data?.value) return {};
    const parsed = JSON.parse(String(data.value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    const now = Date.now();
    const result: ProviderCooldowns = {};
    for (const [provider, until] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const timestamp = Number(until);
      if (Number.isFinite(timestamp) && timestamp > now)
        result[provider] = timestamp;
    }
    return result;
  } catch {
    return {};
  }
}

export async function setProviderCooldown(
  provider: string,
  durationMs: number
): Promise<void> {
  try {
    const db = getAdminClient();
    const current = await loadProviderCooldowns();
    current[provider] = Date.now() + durationMs;
    await db
      .from('system_settings')
      .upsert([{ key: COOLDOWN_KEY, value: JSON.stringify(current) }], {
        onConflict: 'key',
      });
  } catch (error) {
    console.warn('[AI Failover] Could not persist provider cooldown:', error);
  }
}

export async function clearProviderCooldown(provider: string): Promise<void> {
  try {
    const db = getAdminClient();
    const current = await loadProviderCooldowns();
    if (!(provider in current)) return;
    delete current[provider];
    await db
      .from('system_settings')
      .upsert([{ key: COOLDOWN_KEY, value: JSON.stringify(current) }], {
        onConflict: 'key',
      });
  } catch (error) {
    console.warn('[AI Failover] Could not clear provider cooldown:', error);
  }
}

export function isProviderCoolingDown(
  provider: string,
  cooldowns: ProviderCooldowns
): boolean {
  return Number(cooldowns[provider] || 0) > Date.now();
}
