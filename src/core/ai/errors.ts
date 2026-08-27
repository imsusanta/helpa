/**
 * Helpa Core Platform — AI Error Normalization
 *
 * Provides normalized internal error codes for all AI LLM providers
 * (OpenRouter, OrcaRouter, Cloudflare) to ensure consistent user experience and safe fallback routing.
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
 * Determines whether an AI error is transient/retryable and therefore eligible
 * for provider failover. Authentication, invalid-model, malformed-request and
 * policy/tool failures stay on the current provider because switching providers
 * cannot reliably fix the same configuration/request problem.
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
      if (error.status === 402 || error.status === 408 || error.status === 429 || error.status >= 500) {
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
      msg.includes('too many requests') ||
      msg.includes('quota') ||
      msg.includes('credit') ||
      msg.includes('credits') ||
      msg.includes('usage limit') ||
      msg.includes('limit exceeded') ||
      msg.includes('insufficient balance') ||
      msg.includes('payment required') ||
      msg.includes(' 402') ||
      msg.includes(' 408') ||
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
      msg.includes('model not found') ||
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
    status === 402 ||
    status === 408 ||
    status === 429 ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('credit') ||
    lowerMessage.includes('usage limit') ||
    lowerMessage.includes('limit exceeded') ||
    lowerMessage.includes('insufficient balance') ||
    lowerMessage.includes('payment required')
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
