/**
 * Helpa Enterprise Structured Logger
 *
 * Implements recursive PII, PHI, authorization header, and secret redaction.
 * Emits JSON logs compatible with Datadog, CloudWatch, Axiom, and Vercel.
 * Prevents circular reference crashes, log-injection DoS, and patient data leakage.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  accountId?: string;
  component?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY_SUBSTRINGS = [
  'secret',
  'token',
  'password',
  'pass',
  'auth',
  'cookie',
  'session',
  'key',
  'credential',
  'jwt',
  'bearer',
  'signature',
  'medical',
  'diagnosis',
  'prescription',
  'patient_name',
  'patientname',
  'notes',
  'report_pdf',
  'report_url',
  'payload',
];

const SECRET_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /basic\s+[a-zA-Z0-9_\-\.\=]+/gi,
  /key=[a-zA-Z0-9_\-]+/gi,
  /secret=[a-zA-Z0-9_\-]+/gi,
  /token=[a-zA-Z0-9_\-\.]+/gi,
  /password=[^\s&]+/gi,
  /sig=[a-zA-Z0-9_\-]+/gi,
  /signature=[a-zA-Z0-9_\-]+/gi,
];

const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let sanitized = input;

  // Redact secrets and authorization tokens
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }

  // Redact email addresses
  sanitized = sanitized.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

  // Redact phone numbers (preserve last 4 digits if >= 10 chars, else mask completely)
  sanitized = sanitized.replace(PHONE_REGEX, (match) => {
    const cleanDigits = match.replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      return `+**-***-***-${cleanDigits.slice(-4)}`;
    }
    return '[REDACTED_PHONE]';
  });

  // Limit max string size to prevent log flooding
  if (sanitized.length > 2000) {
    return sanitized.slice(0, 2000) + '... [TRUNCATED_OVERSIZE]';
  }

  return sanitized;
}

export function sanitizeObject(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle Error instances safely
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      stack: obj.stack ? sanitizeString(obj.stack.split('\n').slice(0, 4).join('\n')) : undefined,
    };
  }

  // Prevent circular reference infinite loops
  if (seen.has(obj)) {
    return '[CIRCULAR_REFERENCE]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map((item) => sanitizeObject(item, seen));
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(obj as Record<string, unknown>).slice(0, 50);

  for (const [k, v] of entries) {
    const lowerKey = k.toLowerCase();

    // Check if key corresponds to sensitive authorization, secret, or PHI field
    const isSensitiveKey = SENSITIVE_KEY_SUBSTRINGS.some((sub) => lowerKey.includes(sub));

    if (isSensitiveKey) {
      if (lowerKey.includes('phone') && typeof v === 'string') {
        const clean = v.replace(/\D/g, '');
        result[k] = clean.length >= 4 ? `+***...${clean.slice(-4)}` : '[REDACTED_PHONE]';
      } else {
        result[k] = '[REDACTED_SENSITIVE_DATA]';
      }
    } else {
      result[k] = sanitizeObject(v, seen);
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
