/**
 * Structured Logger with Automatic PII / PHI and Secret Sanitization.
 * Emits JSON logs compatible with Datadog, CloudWatch, and Axiom.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  accountId?: string;
  component?: string;
  [key: string]: unknown;
}

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /key=[a-zA-Z0-9_\-]+/gi,
  /secret=[a-zA-Z0-9_\-]+/gi,
  /token=[a-zA-Z0-9_\-]+/gi,
  /password=[a-zA-Z0-9_\-]+/gi,
];

function sanitizeString(input: string): string {
  let sanitized = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('key')
    ) {
      result[k] = '[REDACTED_AUTH]';
    } else if (lowerKey.includes('phone') && typeof v === 'string') {
      result[k] = v.length > 4 ? `+***...${v.slice(-4)}` : '***';
    } else {
      result[k] = sanitizeObject(v);
    }
  }
  return result;
}

export function log(
  level: LogLevel,
  message: string,
  context: LogContext = {}
): void {
  const structuredEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeString(message),
    ...((sanitizeObject(context) as object) || {}),
  };

  const jsonOutput = JSON.stringify(structuredEntry);
  if (level === 'error') {
    console.error(jsonOutput);
  } else if (level === 'warn') {
    console.warn(jsonOutput);
  } else {
    console.log(jsonOutput);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),
};
