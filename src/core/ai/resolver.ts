/**
 * Helpa Core Platform — AI Provider Resolver & Fallback Engine
 *
 * Handles provider selection, bounded retries with exponential backoff,
 * safe fallback routing between Primary and Fallback AI Providers,
 * error normalization, and automatic usage logging.
 */

import { decrypt } from '@/lib/whatsapp/encryption';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { isRetryableAiError, HelpaAiError, normalizeAiError } from './errors';
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
    model: string;
  };
  fallback?: {
    provider: AiProvider;
    apiKey?: string;
    model: string;
  };
}

/**
 * Resolves account-specific or system-default provider configuration for an account.
 */
export async function resolveAccountAiConfig(
  accountId?: string,
  overrides?: Partial<ProviderResolutionParams>
): Promise<ResolvedProviderConfig> {
  let primaryName: AiProviderName = overrides?.primaryProvider || 'openrouter';
  let fallbackName: AiProviderName | 'none' = overrides?.fallbackProvider ?? 'none';
  let openrouterKey: string | undefined = process.env.OPENROUTER_API_KEY;
  let openrouterModel = 'google/gemini-2.5-flash';
  let orcarouterKey: string | undefined = process.env.ORCAROUTER_API_KEY;
  let orcarouterModel = 'orcarouter/auto';

  try {
    const db = appwriteAdmin();

    // 1. Check Super Admin System-Level Defaults in system_settings
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
        settingsMap.system_ai_provider === 'openrouter' ||
        settingsMap.system_ai_provider === 'orcarouter'
      ) {
        primaryName = settingsMap.system_ai_provider;
      }
      if (
        settingsMap.system_ai_fallback_provider === 'openrouter' ||
        settingsMap.system_ai_fallback_provider === 'orcarouter' ||
        settingsMap.system_ai_fallback_provider === 'none'
      ) {
        fallbackName = settingsMap.system_ai_fallback_provider as AiProviderName | 'none';
      }
      if (settingsMap.system_openrouter_model) {
        openrouterModel = settingsMap.system_openrouter_model;
      }
      if (settingsMap.system_orcarouter_model) {
        orcarouterModel = settingsMap.system_orcarouter_model;
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
    }

    // 2. Check Tenant-Specific Account Overrides
    if (accountId) {
      const { data: acc } = await db
        .from('accounts')
        .select(
          'ai_provider, ai_fallback_provider, openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model'
        )
        .eq('id', accountId)
        .maybeSingle();

      if (acc) {
        if (acc.ai_provider === 'openrouter' || acc.ai_provider === 'orcarouter') {
          primaryName = acc.ai_provider;
        }
        if (
          acc.ai_fallback_provider === 'openrouter' ||
          acc.ai_fallback_provider === 'orcarouter' ||
          acc.ai_fallback_provider === 'none'
        ) {
          fallbackName = acc.ai_fallback_provider;
        }
        if (acc.openrouter_model) {
          openrouterModel = acc.openrouter_model;
        }
        if (acc.orcarouter_model) {
          orcarouterModel = acc.orcarouter_model;
        }
        if (acc.openrouter_api_key) {
          try {
            openrouterKey = decrypt(acc.openrouter_api_key);
          } catch {
            // Keep system default if decryption fails
          }
        }
        if (acc.orcarouter_api_key) {
          try {
            orcarouterKey = decrypt(acc.orcarouter_api_key);
          } catch {
            // Keep system default if decryption fails
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Provider Resolver] Failed to load settings, using fallback defaults:', err);
  }

  // Override with custom keys/models if passed directly
  if (overrides?.customApiKey) {
    if (primaryName === 'orcarouter') {
      orcarouterKey = overrides.customApiKey;
    } else {
      openrouterKey = overrides.customApiKey;
    }
  }

  if (overrides?.customModel) {
    if (primaryName === 'orcarouter') {
      orcarouterModel = overrides.customModel;
    } else {
      openrouterModel = overrides.customModel;
    }
  }

  const primaryProvider = getProviderInstance(primaryName);
  const primaryKey = primaryName === 'orcarouter' ? orcarouterKey : openrouterKey;
  const primaryModel = primaryName === 'orcarouter' ? orcarouterModel : openrouterModel;

  let fallbackConfig: ResolvedProviderConfig['fallback'];
  if (fallbackName !== 'none' && fallbackName !== primaryName) {
    const fallbackProvider = getProviderInstance(fallbackName);
    const fallbackKey = fallbackName === 'orcarouter' ? orcarouterKey : openrouterKey;
    const fallbackModel = fallbackName === 'orcarouter' ? orcarouterModel : openrouterModel;
    fallbackConfig = {
      provider: fallbackProvider,
      apiKey: fallbackKey,
      model: fallbackModel,
    };
  }

  return {
    primary: {
      provider: primaryProvider,
      apiKey: primaryKey,
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
  const config = await resolveAccountAiConfig(resolutionParams?.accountId, resolutionParams);
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
        apiKey: options?.apiKey || primary.apiKey,
        model: options?.model || primary.model,
      });

      // Log Usage
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
  const primaryErrNormalized = normalizeAiError(lastError, primary.provider.name);
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
    const fallbackResult = await fallback.provider.generateCompletion(messages, {
      ...options,
      apiKey: fallback.apiKey,
      model: fallback.model,
    });

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
    const normalizedFallbackErr = normalizeAiError(fallbackErr, fallback.provider.name);
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
