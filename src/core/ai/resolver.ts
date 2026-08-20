/**
 * Helpa Core Platform — AI Provider Resolver & Fallback Engine
 *
 * Centralized SaaS-level AI infrastructure resolver managed by Super Admin.
 * Handles provider selection, feature routing, bounded retries with exponential backoff,
 * safe fallback routing between Primary and Fallback AI Providers,
 * error normalization, and automatic usage logging.
 */

import { decrypt } from '@/lib/whatsapp/encryption';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
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

export interface ProviderResolutionParams {
  accountId?: string;
  primaryProvider?: AiProviderName;
  fallbackProvider?: AiProviderName | 'none';
  customApiKey?: string;
  customModel?: string;
  feature?: AiFeatureType;
  conversationId?: string;
}

export interface ResolvedProviderConfig {
  primary: {
    provider: AiProvider;
    apiKey?: string;
    accountId?: string;
    model: string;
  };
  fallback?: {
    provider: AiProvider;
    apiKey?: string;
    accountId?: string;
    model: string;
  };
}

/**
 * Resolves platform-wide Super Admin provider configuration and feature-level model routing.
 */
export async function resolveAccountAiConfig(
  accountId?: string,
  overrides?: Partial<ProviderResolutionParams>
): Promise<ResolvedProviderConfig> {
  let primaryName: AiProviderName = overrides?.primaryProvider || 'openrouter';
  let fallbackName: AiProviderName | 'none' =
    overrides?.fallbackProvider ?? 'none';
  let openrouterKey: string | undefined = process.env.OPENROUTER_API_KEY;
  let openrouterModel = 'google/gemini-2.5-flash';
  let orcarouterKey: string | undefined = process.env.ORCAROUTER_API_KEY;
  let orcarouterModel = 'orcarouter/auto';
  let cloudflareToken: string | undefined = process.env.CLOUDFLARE_API_TOKEN;
  let cloudflareAccountId: string | undefined =
    process.env.CLOUDFLARE_ACCOUNT_ID;
  let cloudflareModel = '@cf/meta/llama-3.1-8b-instruct';

  let openrouterEnabled = true;
  let orcarouterEnabled = true;
  let cloudflareEnabled = true;
  let featureRouting: Record<string, string> = {};

  try {
    const db = appwriteAdmin();

    // 1. Check Super Admin Central AI Infrastructure in system_settings
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
        (settingsMap.system_ai_provider === 'openrouter' ||
          settingsMap.system_ai_provider === 'orcarouter' ||
          settingsMap.system_ai_provider === 'cloudflare')
      ) {
        primaryName = settingsMap.system_ai_provider as AiProviderName;
      }
      if (
        overrides?.fallbackProvider === undefined &&
        (settingsMap.system_ai_fallback_provider === 'openrouter' ||
          settingsMap.system_ai_fallback_provider === 'orcarouter' ||
          settingsMap.system_ai_fallback_provider === 'cloudflare' ||
          settingsMap.system_ai_fallback_provider === 'none')
      ) {
        fallbackName = settingsMap.system_ai_fallback_provider as
          AiProviderName | 'none';
      }
      if (settingsMap.system_openrouter_model && !overrides?.primaryProvider) {
        openrouterModel = settingsMap.system_openrouter_model;
      }
      if (settingsMap.system_orcarouter_model && !overrides?.primaryProvider) {
        orcarouterModel = settingsMap.system_orcarouter_model;
      }
      if (settingsMap.system_cloudflare_model && !overrides?.primaryProvider) {
        cloudflareModel = settingsMap.system_cloudflare_model;
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
    }

    // 2. Check tenant workspace settings in accounts table if accountId is provided
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
          if (
            !overrides?.primaryProvider &&
            (acc.ai_provider === 'openrouter' ||
              acc.ai_provider === 'orcarouter' ||
              acc.ai_provider === 'cloudflare')
          ) {
            primaryName = acc.ai_provider as AiProviderName;
          }
          if (
            overrides?.fallbackProvider === undefined &&
            (acc.ai_fallback_provider === 'openrouter' ||
              acc.ai_fallback_provider === 'orcarouter' ||
              acc.ai_fallback_provider === 'cloudflare' ||
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
        // ignore account query error
      }
    }
  } catch (err) {
    console.warn(
      '[Provider Resolver] Failed to load central settings, using fallback defaults:',
      err
    );
  }

  // Explicit overrides always take precedence
  if (overrides?.primaryProvider) {
    primaryName = overrides.primaryProvider;
  }
  if (overrides?.fallbackProvider !== undefined) {
    fallbackName = overrides.fallbackProvider;
  }

  // If primary provider is explicitly disabled by Super Admin, switch to fallback
  if (
    !overrides?.primaryProvider &&
    primaryName === 'openrouter' &&
    !openrouterEnabled
  ) {
    primaryName = orcarouterEnabled
      ? 'orcarouter'
      : cloudflareEnabled
        ? 'cloudflare'
        : 'openrouter';
  } else if (
    !overrides?.primaryProvider &&
    primaryName === 'orcarouter' &&
    !orcarouterEnabled
  ) {
    primaryName = openrouterEnabled
      ? 'openrouter'
      : cloudflareEnabled
        ? 'cloudflare'
        : 'orcarouter';
  } else if (
    !overrides?.primaryProvider &&
    primaryName === 'cloudflare' &&
    !cloudflareEnabled
  ) {
    primaryName = openrouterEnabled
      ? 'openrouter'
      : orcarouterEnabled
        ? 'orcarouter'
        : 'cloudflare';
  }

  // Apply feature-level model routing if configured by Super Admin
  const feature = overrides?.feature;
  if (feature && featureRouting[feature]) {
    const mappedModel = featureRouting[feature];
    if (primaryName === 'orcarouter') {
      orcarouterModel = mappedModel;
    } else if (primaryName === 'cloudflare') {
      cloudflareModel = mappedModel;
    } else {
      openrouterModel = mappedModel;
    }
  }

  // Override with custom keys/models if passed directly in tests or internal jobs
  if (overrides?.customApiKey) {
    const rawKey = overrides.customApiKey.trim();
    if (rawKey.startsWith('sk-or-') || rawKey.startsWith('sk-openrouter')) {
      openrouterKey = rawKey;
      if (
        !overrides.primaryProvider &&
        (!orcarouterKey || !orcarouterKey.trim())
      ) {
        primaryName = 'openrouter';
      }
    } else if (rawKey.startsWith('sk-orca-') || rawKey.startsWith('orca-')) {
      orcarouterKey = rawKey;
      if (
        !overrides.primaryProvider &&
        (!openrouterKey || !openrouterKey.trim())
      ) {
        primaryName = 'orcarouter';
      }
    } else if (rawKey.includes(':')) {
      const parts = rawKey.split(':');
      cloudflareAccountId = parts[0];
      cloudflareToken = parts.slice(1).join(':');
      if (!overrides.primaryProvider) {
        primaryName = 'cloudflare';
      }
    } else {
      if (primaryName === 'orcarouter') {
        orcarouterKey = rawKey;
      } else if (primaryName === 'cloudflare') {
        cloudflareToken = rawKey;
      } else {
        openrouterKey = rawKey;
      }
    }
  }

  // Automatic smart failover if primary provider has no API key configured but fallback does
  if (
    !overrides?.primaryProvider &&
    primaryName === 'orcarouter' &&
    (!orcarouterKey || !orcarouterKey.trim()) &&
    openrouterKey &&
    openrouterKey.trim()
  ) {
    primaryName = 'openrouter';
    fallbackName = 'none';
  } else if (
    !overrides?.primaryProvider &&
    primaryName === 'openrouter' &&
    (!openrouterKey || !openrouterKey.trim()) &&
    orcarouterKey &&
    orcarouterKey.trim()
  ) {
    primaryName = 'orcarouter';
    fallbackName = 'none';
  }

  if (overrides?.customModel) {
    const cleanCustom = sanitizeModelIdentifier(overrides.customModel);
    if (cleanCustom) {
      if (primaryName === 'orcarouter') {
        orcarouterModel = cleanCustom;
      } else if (primaryName === 'cloudflare') {
        cloudflareModel = cleanCustom;
      } else {
        openrouterModel = cleanCustom;
      }
    }
  }

  const primaryProvider = getProviderInstance(primaryName);
  let primaryKey = openrouterKey;
  let primaryModel = openrouterModel;
  let primaryAccountId: string | undefined = undefined;

  if (primaryName === 'orcarouter') {
    primaryKey = orcarouterKey;
    primaryModel = orcarouterModel;
  } else if (primaryName === 'cloudflare') {
    primaryKey = cloudflareToken;
    primaryModel = cloudflareModel;
    primaryAccountId = cloudflareAccountId;
  }

  let fallbackConfig: ResolvedProviderConfig['fallback'];
  if (fallbackName !== 'none' && fallbackName !== primaryName) {
    const isFallbackEnabled =
      fallbackName === 'orcarouter'
        ? orcarouterEnabled
        : fallbackName === 'cloudflare'
          ? cloudflareEnabled
          : openrouterEnabled;

    if (isFallbackEnabled) {
      const fallbackProvider = getProviderInstance(fallbackName);
      let fallbackKey = openrouterKey;
      let fallbackModel = openrouterModel;
      let fallbackAccountId: string | undefined = undefined;

      if (fallbackName === 'orcarouter') {
        fallbackKey = orcarouterKey;
        fallbackModel = orcarouterModel;
      } else if (fallbackName === 'cloudflare') {
        fallbackKey = cloudflareToken;
        fallbackModel = cloudflareModel;
        fallbackAccountId = cloudflareAccountId;
      }

      fallbackConfig = {
        provider: fallbackProvider,
        apiKey: fallbackKey,
        accountId: fallbackAccountId,
        model: fallbackModel,
      };
    }
  }

  return {
    primary: {
      provider: primaryProvider,
      apiKey: primaryKey,
      accountId: primaryAccountId,
      model: primaryModel,
    },
    fallback: fallbackConfig,
  };
}

/**
 * Executes an AI completion request using Primary Provider with bounded retries
 * and automatic Fallback Provider fallback if primary fails with a retryable error.
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

  // 1. Attempt Primary Provider with Bounded Retries (max 2 attempts)
  let lastError: unknown = null;
  const primary = config.primary;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await primary.provider.generateCompletion(messages, {
        ...options,
        apiKey: primary.apiKey || options?.apiKey,
        accountId: primary.accountId || options?.accountId,
        model: options?.model || primary.model,
      });

      // Log Usage per tenant workspace
      trackAiUsage({
        workspaceId,
        conversationId,
        provider: primary.provider.name,
        model: result.model,
        feature,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        status: 'success',
      });

      return result;
    } catch (err) {
      lastError = err;
      const normalized = normalizeAiError(err, primary.provider.name);

      // If error is non-retryable (401 auth, 400 bad request, etc.), do NOT retry or fallback
      if (!isRetryableAiError(normalized)) {
        trackAiUsage({
          workspaceId,
          conversationId,
          provider: primary.provider.name,
          model: options?.model || primary.model,
          feature,
          status: 'failed',
          errorType: normalized.code,
        });
        throw normalized;
      }

      // If attempt 1 failed with retryable error, wait with exponential backoff before retry/fallback
      if (attempt < 2) {
        await new Promise((res) => setTimeout(res, 500 * attempt));
      }
    }
  }

  // Record Primary Provider failure
  const primaryErrNormalized = normalizeAiError(
    lastError,
    primary.provider.name
  );
  trackAiUsage({
    workspaceId,
    conversationId,
    provider: primary.provider.name,
    model: options?.model || primary.model,
    feature,
    status: 'failed',
    errorType: primaryErrNormalized.code,
  });

  // 2. Check if Fallback Provider is configured
  if (!config.fallback) {
    throw primaryErrNormalized;
  }

  // 3. Attempt Fallback Provider
  const fallback = config.fallback;
  console.warn(
    `[AI Engine Fallback] Primary provider (${primary.provider.name}) failed. Falling back to (${fallback.provider.name}). Error:`,
    primaryErrNormalized.message
  );

  try {
    const fallbackResult = await fallback.provider.generateCompletion(
      messages,
      {
        ...options,
        apiKey: fallback.apiKey,
        accountId: fallback.accountId || options?.accountId,
        model: fallback.model,
      }
    );

    trackAiUsage({
      workspaceId,
      conversationId,
      provider: fallback.provider.name,
      model: fallbackResult.model,
      feature,
      promptTokens: fallbackResult.promptTokens,
      completionTokens: fallbackResult.completionTokens,
      totalTokens: fallbackResult.totalTokens,
      latencyMs: fallbackResult.latencyMs,
      status: 'success',
    });

    return fallbackResult;
  } catch (fallbackErr) {
    const normalizedFallbackErr = normalizeAiError(
      fallbackErr,
      fallback.provider.name
    );
    trackAiUsage({
      workspaceId,
      conversationId,
      provider: fallback.provider.name,
      model: fallback.model,
      feature,
      status: 'failed',
      errorType: normalizedFallbackErr.code,
    });

    throw new HelpaAiError(
      `Both primary provider (${primary.provider.name}) and fallback provider (${fallback.provider.name}) failed. Primary: ${primaryErrNormalized.message} | Fallback: ${normalizedFallbackErr.message}`,
      'AI_PROVIDER_UNAVAILABLE',
      'core-ai-engine',
      503,
      fallbackErr
    );
  }
}
