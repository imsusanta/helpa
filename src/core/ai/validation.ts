/**
 * Helpa Core Platform — AI Model Validation & Sanitization
 *
 * Ensures custom model IDs for OpenRouter and OrcaRouter follow correct
 * provider naming conventions and prevents configuration errors.
 */

export interface ModelValidationResult {
  valid: boolean;
  normalizedId: string;
  error?: string;
}

/**
 * Strips whitespace, quotes, backticks, leading/trailing slashes and illegal characters.
 */
export function sanitizeModelIdentifier(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/['"`]/g, '') // remove quotes/backticks
    .replace(/^\/+|\/+$/g, '') // remove leading/trailing slashes
    .replace(/\s+/g, ''); // remove internal whitespace
}

/**
 * Validates model identifier against OpenRouter or OrcaRouter specifications.
 */
export function validateAiModelId(
  raw: string,
  provider: 'openrouter' | 'orcarouter' = 'openrouter'
): ModelValidationResult {
  const normalized = sanitizeModelIdentifier(raw);

  if (!normalized) {
    return {
      valid: false,
      normalizedId: '',
      error: 'Model identifier cannot be empty.',
    };
  }

  if (normalized.length < 3 || normalized.length > 128) {
    return {
      valid: false,
      normalizedId: normalized,
      error: 'Model identifier length must be between 3 and 128 characters.',
    };
  }

  // OpenRouter standard format: organization/model-name or organization/model-name:tag
  // Examples: 'google/gemini-2.5-flash', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct:free'
  if (provider === 'openrouter') {
    const openRouterPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/;
    if (!openRouterPattern.test(normalized)) {
      return {
        valid: false,
        normalizedId: normalized,
        error:
          'Invalid OpenRouter model format. Expected format: "organization/model-name" (e.g., deepseek/deepseek-r1 or google/gemini-2.5-flash).',
      };
    }
  }

  // OrcaRouter format: 'orcarouter/auto' or 'organization/model-name' or single-token aliases
  if (provider === 'orcarouter') {
    const orcaPattern = /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.:-]+)?$/;
    if (!orcaPattern.test(normalized)) {
      return {
        valid: false,
        normalizedId: normalized,
        error:
          'Invalid OrcaRouter model format. Expected format: "orcarouter/auto" or "provider/model-name".',
      };
    }
  }

  return {
    valid: true,
    normalizedId: normalized,
  };
}
