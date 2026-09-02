/**
 * Helpa Core Platform — AI Provider Resolver & Fallback Engine
 *
 * Centralized SaaS-level AI infrastructure resolver managed by Super Admin.
 * Handles provider selection, feature routing, bounded retries, automatic
 * multi-provider failover, persistent cooldowns, safe routing, error
 * normalization, usage logging, and secret-safe admin alerts.
 */

import { decrypt } from '@/lib/whatsapp/encryption';
import { getAdminClient } from '@/lib/db/server';
import { isRetryableAiError, HelpaAiError, normalizeAiError } from './errors';
import { sanitizeModelIdentifier } from './validation';
import {
  getProviderInstance,
  type AiCompletionOptions,
  type AiCompletionResult,
  type AiMessage,
  type AiProvider,
} from './provider';
import type { AiFeatureType, AiProviderName } from './types';
import { trackAiUsage } from './usage-tracker';
import {
  clearProviderCooldown,
  isProviderCoolingDown,
  loadProviderCooldowns,
  setProviderCooldown,
} from './failover-state';

const PROVIDER_ORDER: AiProviderName[] = [
  'cloudflare',
  'openrouter',
  'orcarouter',
];
const MAX_PRIMARY_ATTEMPTS = 2;
const MAX_FALLBACK_ATTEMPTS = 1;
const RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000;
const TRANSIENT_COOLDOWN_MS = 10 * 60 * 1000;

export interface ProviderResolutionParams {
  accountId?: string;
  primaryProvider?: AiProviderName;
  fallbackProvider?: AiProviderName | 'none';
  customApiKey?: string;
  customModel?: string;
  feature?: AiFeatureType;
  conversationId?: string;
}

export interface ResolvedProviderEntry {
  provider: AiProvider;
  apiKey?: string;
  accountId?: string;
  model: string;
}

export interface ResolvedProviderConfig {
  primary: ResolvedProviderEntry;
  /** Backward-compatible first fallback provider. */
  fallback?: ResolvedProviderEntry;
  /** Ordered failover chain after primary. */
  fallbacks: ResolvedProviderEntry[];
}

function isProviderName(value: unknown): value is AiProviderName {
  return (
    value === 'cloudflare' || value === 'openrouter' || value === 'orcarouter'
  );
}

function parseFallbackList(value: string | undefined): AiProviderName[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(isProviderName);
  } catch {
    // Also accept a simple comma-separated value for backwards compatibility.
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(isProviderName);
}

/**
 * Resolves platform-wide provider configuration and builds an ordered
 * multi-provider failover chain. Existing single fallback settings remain
 * supported; when no explicit chain is configured, all enabled providers are
 * automatically appended in the safe order Cloudflare -> OpenRouter -> OrcaRouter.
 */
export async function resolveAccountAiConfig(
  accountId?: string,
  overrides?: Partial<ProviderResolutionParams>
): Promise<ResolvedProviderConfig> {
  let primaryName: AiProviderName = overrides?.primaryProvider || 'cloudflare';
  let fallbackName: AiProviderName | 'none' =
    overrides?.fallbackProvider ?? 'none';
  let configuredFallbacks: AiProviderName[] = [];
  let openrouterKey: string | undefined = process.env.OPENROUTER_API_KEY;
  let openrouterModel = 'google/gemini-2.5-flash';
  let orcarouterKey: string | undefined = process.env.ORCAROUTER_API_KEY;
  let orcarouterModel = 'orcarouter/auto';
  let cloudflareToken: string | undefined = process.env.CLOUDFLARE_API_TOKEN;
  let cloudflareAccountId: string | undefined =
    process.env.CLOUDFLARE_ACCOUNT_ID;
  let cloudflareModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

  let openrouterEnabled = true;
  let orcarouterEnabled = true;
  let cloudflareEnabled = true;
  let featureRouting: Record<string, string> = {};
  let providerCooldowns = await loadProviderCooldowns();

  try {
    const db = getAdminClient();
    const { data: sysSettings } = await db
      .from('system_settings')
      .select('key, value');

    if (sysSettings) {
      const settingsMap: Record<string, string> = {};
      sysSettings.forEach((row: Record<string, unknown>) => {
        if (typeof row.key === 'string' && typeof row.value === 'string') {
          settingsMap[row.key] = row.value;
        }
      });

      if (
        !overrides?.primaryProvider &&
        isProviderName(settingsMap.system_ai_provider)
      ) {
        primaryName = settingsMap.system_ai_provider;
      }
      if (
        overrides?.fallbackProvider === undefined &&
        (isProviderName(settingsMap.system_ai_fallback_provider) ||
          settingsMap.system_ai_fallback_provider === 'none')
      ) {
        fallbackName = settingsMap.system_ai_fallback_provider as
          AiProviderName | 'none';
      }
      configuredFallbacks = parseFallbackList(
        settingsMap.system_ai_fallback_providers
      );

      if (settingsMap.system_openrouter_model && !overrides?.primaryProvider) {
        openrouterModel = settingsMap.system_openrouter_model;
      }
      if (settingsMap.system_orcarouter_model && !overrides?.primaryProvider) {
        orcarouterModel = settingsMap.system_orcarouter_model;
      }
      if (settingsMap.system_cloudflare_model && !overrides?.primaryProvider) {
        cloudflareModel = settingsMap.system_cloudflare_model;
      }
      if (cloudflareModel === '@cf/meta/llama-3.1-8b-instruct') {
        cloudflareModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
      }
      if (settingsMap.system_cloudflare_account_id) {
        cloudflareAccountId = settingsMap.system_cloudflare_account_id;
      }
      if (settingsMap.system_openrouter_enabled !== undefined) {
        openrouterEnabled = settingsMap.system_openrouter_enabled !== 'false';
      }
      if (settingsMap.system_orcarouter_enabled !== undefined) {
        orcarouterEnabled = settingsMap.system_orcarouter_enabled !== 'false';
      }
      if (settingsMap.system_cloudflare_enabled !== undefined) {
        cloudflareEnabled = settingsMap.system_cloudflare_enabled !== 'false';
      }

      if (settingsMap.system_openrouter_api_key) {
        try {
          openrouterKey = decrypt(settingsMap.system_openrouter_api_key);
        } catch {
          openrouterKey = process.env.OPENROUTER_API_KEY;
        }
      }
      if (settingsMap.system_orcarouter_api_key) {
        try {
          orcarouterKey = decrypt(settingsMap.system_orcarouter_api_key);
        } catch {
          orcarouterKey = process.env.ORCAROUTER_API_KEY;
        }
      }
      if (settingsMap.system_cloudflare_api_token) {
        try {
          cloudflareToken = decrypt(settingsMap.system_cloudflare_api_token);
        } catch {
          cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
        }
      }
      if (settingsMap.system_feature_routing) {
        try {
          featureRouting = JSON.parse(settingsMap.system_feature_routing);
        } catch {
          featureRouting = {};
        }
      }
      if (settingsMap.system_ai_provider_cooldowns) {
        try {
          const stored = JSON.parse(settingsMap.system_ai_provider_cooldowns);
          if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
            providerCooldowns = stored as Record<string, number>;
          }
        } catch {
          // keep failover-state value
        }
      }
    }

    if (accountId && accountId !== 'system') {
      try {
        const { data: acc } = await db
          .from('accounts')
          .select(
            'ai_provider, ai_fallback_provider, openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model, cloudflare_account_id, cloudflare_api_token, cloudflare_model'
          )
          .eq('id', accountId)
          .maybeSingle();

        if (acc) {
          if (!overrides?.primaryProvider && isProviderName(acc.ai_provider)) {
            primaryName = acc.ai_provider;
          }
          if (
            overrides?.fallbackProvider === undefined &&
            (isProviderName(acc.ai_fallback_provider) ||
              acc.ai_fallback_provider === 'none')
          ) {
            fallbackName = acc.ai_fallback_provider as AiProviderName | 'none';
          }
          if (acc.openrouter_model && !overrides?.primaryProvider) {
            openrouterModel = acc.openrouter_model;
          }
          if (acc.orcarouter_model && !overrides?.primaryProvider) {
            orcarouterModel = acc.orcarouter_model;
          }
          if (acc.cloudflare_model && !overrides?.primaryProvider) {
            cloudflareModel = acc.cloudflare_model;
          }
          if (cloudflareModel === '@cf/meta/llama-3.1-8b-instruct') {
            cloudflareModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
          }
          if (acc.cloudflare_account_id) {
            cloudflareAccountId = acc.cloudflare_account_id;
          }
          if (acc.openrouter_api_key) {
            try {
              openrouterKey = decrypt(acc.openrouter_api_key);
            } catch {
              openrouterKey = acc.openrouter_api_key;
            }
          }
          if (acc.orcarouter_api_key) {
            try {
              orcarouterKey = decrypt(acc.orcarouter_api_key);
            } catch {
              orcarouterKey = acc.orcarouter_api_key;
            }
          }
          if (acc.cloudflare_api_token) {
            try {
              cloudflareToken = decrypt(acc.cloudflare_api_token);
            } catch {
              cloudflareToken = acc.cloudflare_api_token;
            }
          }
        }
      } catch {
        // Account-level AI settings are optional; keep central configuration.
      }
    }
  } catch (err) {
    console.warn(
      '[Provider Resolver] Failed to load central settings, using fallback defaults:',
      err
    );
  }

  if (overrides?.primaryProvider) primaryName = overrides.primaryProvider;
  if (overrides?.fallbackProvider !== undefined) {
    fallbackName = overrides.fallbackProvider;
  }

  if (overrides?.customApiKey) {
    const rawKey = overrides.customApiKey.trim();
    if (rawKey.startsWith('sk-or-') || rawKey.startsWith('sk-openrouter')) {
      openrouterKey = rawKey;
      if (!overrides.primaryProvider && !orcarouterKey?.trim()) {
        primaryName = 'openrouter';
      }
    } else if (rawKey.startsWith('sk-orca-') || rawKey.startsWith('orca-')) {
      orcarouterKey = rawKey;
      if (!overrides.primaryProvider && !openrouterKey?.trim()) {
        primaryName = 'orcarouter';
      }
    } else if (rawKey.includes(':')) {
      const parts = rawKey.split(':');
      cloudflareAccountId = parts[0];
      cloudflareToken = parts.slice(1).join(':');
      if (!overrides.primaryProvider) primaryName = 'cloudflare';
    } else if (primaryName === 'orcarouter') {
      orcarouterKey = rawKey;
    } else if (primaryName === 'cloudflare') {
      cloudflareToken = rawKey;
    } else {
      openrouterKey = rawKey;
    }
  }

  if (overrides?.customModel) {
    const cleanCustom = sanitizeModelIdentifier(overrides.customModel);
    if (cleanCustom) {
      if (primaryName === 'orcarouter') orcarouterModel = cleanCustom;
      else if (primaryName === 'cloudflare') cloudflareModel = cleanCustom;
      else openrouterModel = cleanCustom;
    }
  }

  const enabled: Record<AiProviderName, boolean> = {
    cloudflare: cloudflareEnabled,
    openrouter: openrouterEnabled,
    orcarouter: orcarouterEnabled,
  };

  const keys: Record<AiProviderName, string | undefined> = {
    cloudflare: cloudflareToken,
    openrouter: openrouterKey,
    orcarouter: orcarouterKey,
  };
  const models: Record<AiProviderName, string> = {
    cloudflare: cloudflareModel,
    openrouter: openrouterModel,
    orcarouter: orcarouterModel,
  };
  const accountIds: Record<AiProviderName, string | undefined> = {
    cloudflare: cloudflareAccountId,
    openrouter: undefined,
    orcarouter: undefined,
  };

  if (featureRouting[overrides?.feature || '']) {
    const mappedModel = featureRouting[overrides?.feature || ''];
    if (primaryName === 'cloudflare' && mappedModel.startsWith('@cf/')) {
      models.cloudflare = mappedModel;
    } else if (
      primaryName !== 'cloudflare' &&
      !mappedModel.startsWith('@cf/')
    ) {
      models[primaryName] = mappedModel;
    }
  }

  const makeEntry = (name: AiProviderName): ResolvedProviderEntry => ({
    provider: getProviderInstance(name),
    apiKey: keys[name],
    accountId: accountIds[name],
    model: models[name],
  });

  const preferredFallbacks: AiProviderName[] = [];
  if (configuredFallbacks.length)
    preferredFallbacks.push(...configuredFallbacks);
  if (fallbackName !== 'none' && isProviderName(fallbackName)) {
    preferredFallbacks.unshift(fallbackName);
  }
  preferredFallbacks.push(
    ...PROVIDER_ORDER.filter((name) => name !== primaryName)
  );

  const orderedUnique = Array.from(new Set(preferredFallbacks)).filter(
    (name) =>
      name !== primaryName && enabled[name] && Boolean(keys[name]?.trim())
  );

  // If primary is cooling down and this is not an explicit override, start with
  // the first healthy configured provider. The primary remains in the fallback
  // chain so it can recover after its cooldown expires.
  const primaryCooling = isProviderCoolingDown(primaryName, providerCooldowns);
  let effectivePrimaryName = primaryName;
  let fallbacks = orderedUnique;
  if (
    !overrides?.primaryProvider &&
    primaryCooling &&
    orderedUnique.length > 0
  ) {
    effectivePrimaryName = orderedUnique[0];
    fallbacks = [primaryName, ...orderedUnique.slice(1)];
  }

  // If the selected primary has no credentials, move to the first configured
  // provider rather than returning an unusable primary configuration.
  if (!keys[effectivePrimaryName]?.trim()) {
    const firstAvailable = orderedUnique.find(
      (name) => !isProviderCoolingDown(name, providerCooldowns)
    );
    if (firstAvailable) {
      effectivePrimaryName = firstAvailable;
      fallbacks = Array.from(
        new Set([
          primaryName,
          ...orderedUnique.filter((name) => name !== firstAvailable),
        ])
      ).filter((name) => name !== firstAvailable);
    }
  }

  const primary = makeEntry(effectivePrimaryName);
  const fallbackEntries = fallbacks
    .filter((name) => name !== effectivePrimaryName)
    .map(makeEntry);

  return {
    primary,
    fallback: fallbackEntries[0],
    fallbacks: fallbackEntries,
  };
}

function cooldownForError(error: HelpaAiError): number {
  return error.code === 'AI_RATE_LIMITED'
    ? RATE_LIMIT_COOLDOWN_MS
    : TRANSIENT_COOLDOWN_MS;
}

async function recordProviderFailure(
  provider: AiProviderName,
  error: HelpaAiError,
  workspaceId: string,
  conversationId: string | undefined
): Promise<void> {
  await setProviderCooldown(provider, cooldownForError(error));
  try {
    const db = getAdminClient();
    await db.from('audit_logs').insert({
      account_id: workspaceId,
      actor_id: workspaceId,
      action: 'AI_PROVIDER_FAILOVER',
      resource_type: 'ai_provider',
      resource_id: provider,
      metadata: {
        provider,
        error_code: error.code,
        status: error.status || null,
        conversation_id: conversationId || null,
        cooldown_minutes: cooldownForError(error) / 60000,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Alert/audit must never break the AI fallback path.
  }
}

/**
 * Executes AI with bounded retries and automatic multi-provider failover.
 * Primary gets up to two attempts; each fallback gets one attempt to keep
 * WhatsApp response latency bounded. Retryable provider failures activate a
 * persistent cooldown and a secret-free audit alert.
 */
export async function executeAiCompletionWithFallback({
  messages,
  options,
  resolutionParams,
}: {
  messages: AiMessage[];
  options?: AiCompletionOptions;
  resolutionParams?: ProviderResolutionParams;
}): Promise<AiCompletionResult> {
  const config = await resolveAccountAiConfig(
    resolutionParams?.accountId,
    resolutionParams
  );
  const feature: AiFeatureType = resolutionParams?.feature || 'AI_REPLY';
  const workspaceId = resolutionParams?.accountId || 'system';
  const conversationId = resolutionParams?.conversationId;

  const candidates: Array<{ entry: ResolvedProviderEntry; attempts: number }> =
    [
      { entry: config.primary, attempts: MAX_PRIMARY_ATTEMPTS },
      ...config.fallbacks.map((entry) => ({
        entry,
        attempts: MAX_FALLBACK_ATTEMPTS,
      })),
    ];

  let lastError: HelpaAiError | null = null;

  const cooldowns = await loadProviderCooldowns();
  const hasHealthyCandidate = candidates.some(
    (c) =>
      !isProviderCoolingDown(
        c.entry.provider.name as AiProviderName,
        cooldowns
      ) && Boolean(c.entry.apiKey?.trim())
  );

  for (const candidate of candidates) {
    const { entry, attempts } = candidate;
    const providerName = entry.provider.name as AiProviderName;

    if (!entry.apiKey?.trim()) continue;

    if (hasHealthyCandidate && isProviderCoolingDown(providerName, cooldowns)) {
      console.warn(
        `[AI Failover] Skipping cooling-down provider: ${providerName}`
      );
      continue;
    }

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await entry.provider.generateCompletion(messages, {
          ...options,
          apiKey: entry.apiKey || options?.apiKey,
          accountId: entry.accountId || options?.accountId,
          model: options?.model || entry.model,
        });

        await clearProviderCooldown(providerName);

        trackAiUsage({
          workspaceId,
          conversationId,
          provider: providerName,
          model: result.model,
          feature,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          latencyMs: result.latencyMs,
          status: 'success',
        });

        if (providerName !== config.primary.provider.name) {
          console.warn(
            `[AI Engine Fallback] Provider ${providerName} recovered the request after primary failure.`
          );
        }
        return result;
      } catch (err) {
        const normalized = normalizeAiError(err, providerName);
        lastError = normalized;

        if (!isRetryableAiError(normalized)) {
          trackAiUsage({
            workspaceId,
            conversationId,
            provider: providerName,
            model: options?.model || entry.model,
            feature,
            status: 'failed',
            errorType: normalized.code,
          });
          throw normalized;
        }

        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    if (lastError) {
      await recordProviderFailure(
        providerName,
        lastError,
        workspaceId,
        conversationId
      );
      trackAiUsage({
        workspaceId,
        conversationId,
        provider: providerName,
        model: options?.model || entry.model,
        feature,
        status: 'failed',
        errorType: lastError.code,
      });
    }
  }

  const finalError =
    lastError ||
    new HelpaAiError(
      'No configured AI provider is currently available.',
      'AI_PROVIDER_UNAVAILABLE',
      'core-ai-engine',
      503
    );

  throw new HelpaAiError(
    `All configured AI providers failed or are cooling down. Last provider: ${finalError.provider}. ${finalError.message}`,
    'AI_PROVIDER_UNAVAILABLE',
    'core-ai-engine',
    503,
    finalError
  );
}
