/**
 * Helpa Core Security — Data Sanitization & Log Masking
 *
 * Prevents credential, secret, and sensitive personal/medical data leakage in logs and responses.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /access_token/i,
  /refresh_token/i,
  /credential/i,
  /cvv/i,
  /card_number/i,
];

/**
 * Masks sensitive phone numbers for safe logging (e.g. +91******1234).
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  const prefixLength = clean.startsWith('+') ? 3 : 2;
  const prefix = clean.slice(0, prefixLength);
  const suffix = clean.slice(-4);
  const maskedCount = Math.max(1, clean.length - prefixLength - 4);
  return `${prefix}${'*'.repeat(maskedCount)}${suffix}`;
}

/**
 * Deeply sanitizes an object by redacting any sensitive fields.
 */
export function sanitizeLogMetadata(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogMetadata(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeLogMetadata(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
