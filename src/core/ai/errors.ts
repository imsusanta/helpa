/**
 * Helpa Core Platform — AI Error Normalization
 *
 * Provides normalized internal error codes for all AI LLM providers
 * (OpenRouter, OrcaRouter) to ensure consistent user experience and safe fallback routing.
 */

export type AiErrorCode =
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_AUTHENTICATION_FAILED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_REQUEST'
  | 'AI_TOOL_ERROR';

export class HelpaAiError extends Error {
  public readonly code: AiErrorCode;
  public readonly status?: number;
  public readonly provider: string;
  public readonly rawError?: unknown;

  constructor(
    message: string,
    code: AiErrorCode,
    provider: string,
    status?: number,
    rawError?: unknown
  ) {
    super(message);
    this.name = 'HelpaAiError';
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.rawError = rawError;
  }
}

/**
 * Determines whether an AI error is transient/retryable (eligible for provider fallback).
 * Per rules:
 * Do NOT fallback for:
 * - Invalid request (400)
 * - Permission denied / Auth failed (401, 403)
 * - Unsupported tool
 * - Policy rejection
 * - Invalid model configuration
 *
 * Fallback ONLY for:
 * - Rate limits (429)
 * - Server errors (500, 502, 503, 504)
 * - Timeouts
 * - Network connectivity failures
 */
export function isRetryableAiError(error: unknown): boolean {
  if (error instanceof HelpaAiError) {
    switch (error.code) {
      case 'AI_PROVIDER_UNAVAILABLE':
      case 'AI_RATE_LIMITED':
      case 'AI_TIMEOUT':
        return true;
      case 'AI_AUTHENTICATION_FAILED':
      case 'AI_INVALID_REQUEST':
      case 'AI_MODEL_UNAVAILABLE':
      case 'AI_TOOL_ERROR':
        return false;
      default:
        break;
    }
    if (error.status) {
      if (error.status === 429 || error.status >= 500) {
        return true;
      }
      if (
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404
      ) {
        return false;
      }
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('abort') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('fetch failed') ||
      msg.includes('rate limit') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('500')
    ) {
      return true;
    }
    if (
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden') ||
      msg.includes('invalid model') ||
      msg.includes('invalid request')
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Normalizes any raw provider error into a standard HelpaAiError.
 */
export function normalizeAiError(
  error: unknown,
  providerName: string
): HelpaAiError {
  if (error instanceof HelpaAiError) {
    return error;
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = rawMessage.toLowerCase();

  let code: AiErrorCode = 'AI_PROVIDER_UNAVAILABLE';
  let status: number | undefined;

  const statusMatch =
    rawMessage.match(/HTTP (\d{3})/i) || rawMessage.match(/status (\d{3})/i);
  if (statusMatch) {
    status = parseInt(statusMatch[1], 10);
  }

  if (
    status === 401 ||
    status === 403 ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('unauthorized')
  ) {
    code = 'AI_AUTHENTICATION_FAILED';
  } else if (
    status === 429 ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests')
  ) {
    code = 'AI_RATE_LIMITED';
  } else if (
    lowerMessage.includes('abort') ||
    lowerMessage.includes('timeout')
  ) {
    code = 'AI_TIMEOUT';
  } else if (status === 400 || lowerMessage.includes('invalid request')) {
    code = 'AI_INVALID_REQUEST';
  } else if (
    status === 404 ||
    lowerMessage.includes('model not found') ||
    lowerMessage.includes('does not exist')
  ) {
    code = 'AI_MODEL_UNAVAILABLE';
  } else if (status && status >= 500) {
    code = 'AI_PROVIDER_UNAVAILABLE';
  }

  return new HelpaAiError(
    `[${providerName}] ${rawMessage}`,
    code,
    providerName,
    status,
    error
  );
}
