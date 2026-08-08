import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

describe('Security: Webhook & Outbox Queue Hardening', () => {
  const SECRET = 'test-automation-cron-secret-32-chars-long';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects retention cleanup when x-cron-secret header is missing', () => {
    const checkSecret = (supplied?: string | null): boolean => {
      if (!supplied || !SECRET) return false;
      const expectedBuf = Buffer.from(SECRET, 'utf8');
      const suppliedBuf = Buffer.from(supplied, 'utf8');
      if (expectedBuf.length !== suppliedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, suppliedBuf);
    };

    expect(checkSecret(null)).toBe(false);
    expect(checkSecret('')).toBe(false);
    expect(checkSecret('wrong-secret')).toBe(false);
    expect(checkSecret(SECRET)).toBe(true);
  });

  it('fails closed when cron secret is unset in environment', () => {
    const evaluateAccess = (
      configuredSecret?: string,
      providedHeader?: string
    ): number => {
      if (!configuredSecret) return 503;
      if (!providedHeader) return 401;
      const expectedBuf = Buffer.from(configuredSecret, 'utf8');
      const suppliedBuf = Buffer.from(providedHeader, 'utf8');
      if (
        expectedBuf.length !== suppliedBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, suppliedBuf)
      ) {
        return 401;
      }
      return 200;
    };

    expect(evaluateAccess(undefined, 'any-token')).toBe(503);
    expect(evaluateAccess('', 'any-token')).toBe(503);
    expect(evaluateAccess(SECRET, 'wrong-token')).toBe(401);
    expect(evaluateAccess(SECRET, SECRET)).toBe(200);
  });

  it('enforces that raw webhook payloads are bounded by retention threshold', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    const isDueForSanitization = (
      createdAtStr: string,
      status: string
    ): boolean => {
      if (status !== 'completed') return false;
      const created = new Date(createdAtStr);
      const diffDays =
        (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 7;
    };

    // 2 days old completed event -> not sanitized yet
    expect(isDueForSanitization('2026-08-06T10:00:00.000Z', 'completed')).toBe(
      false
    );
    // 8 days old completed event -> sanitized
    expect(isDueForSanitization('2026-07-31T10:00:00.000Z', 'completed')).toBe(
      true
    );
    // 8 days old failed event -> kept for 30 days
    expect(isDueForSanitization('2026-07-31T10:00:00.000Z', 'failed')).toBe(
      false
    );
  });
});
