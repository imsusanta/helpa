import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRateLimitForTests,
  __setRedisClientForTests,
  checkRateLimit,
  rateLimitResponse,
} from './rate-limit';

const OPTS = { limit: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it('permits the first request and decrements remaining', async () => {
    const result = await checkRateLimit('user:1', OPTS);
    expect(result).toMatchObject({
      success: true,
      remaining: 2,
      limit: 3,
    });
    expect(result.reset).toBeGreaterThan(Date.now());
  });

  it('permits exactly `limit` requests then rejects the next', async () => {
    expect((await checkRateLimit('user:1', OPTS)).success).toBe(true);
    expect((await checkRateLimit('user:1', OPTS)).success).toBe(true);
    expect((await checkRateLimit('user:1', OPTS)).success).toBe(true);
    const over = await checkRateLimit('user:1', OPTS);
    expect(over.success).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it('keeps separate counters per key', async () => {
    await checkRateLimit('user:1', OPTS);
    await checkRateLimit('user:1', OPTS);
    await checkRateLimit('user:1', OPTS);
    const other = await checkRateLimit('user:2', OPTS);
    expect(other.success).toBe(true);
    expect(other.remaining).toBe(2);
  });

  it('opens a fresh window after `windowMs` elapses', async () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date('2026-05-01T00:00:00Z').getTime();
      vi.setSystemTime(t0);
      __resetRateLimitForTests();

      await checkRateLimit('user:1', OPTS);
      await checkRateLimit('user:1', OPTS);
      await checkRateLimit('user:1', OPTS);
      expect((await checkRateLimit('user:1', OPTS)).success).toBe(false);

      vi.setSystemTime(t0 + OPTS.windowMs + 1);
      const refreshed = await checkRateLimit('user:1', OPTS);
      expect(refreshed.success).toBe(true);
      expect(refreshed.remaining).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('checkRateLimit redis backend', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it('uses Redis INCR when a client is injected', async () => {
    const evalMock = vi.fn();
    evalMock
      .mockResolvedValueOnce([1, 60_000])
      .mockResolvedValueOnce([2, 59_000])
      .mockResolvedValueOnce([3, 58_000])
      .mockResolvedValueOnce([4, 57_000]);
    __setRedisClientForTests({ eval: evalMock });

    expect((await checkRateLimit('user:redis', OPTS)).success).toBe(true);
    expect((await checkRateLimit('user:redis', OPTS)).success).toBe(true);
    expect((await checkRateLimit('user:redis', OPTS)).success).toBe(true);
    const over = await checkRateLimit('user:redis', OPTS);
    expect(over.success).toBe(false);
    expect(evalMock).toHaveBeenCalledTimes(4);
    expect(evalMock.mock.calls[0][1]).toMatchObject({
      keys: ['rl:user:redis'],
    });
  });

  it('falls back to memory if Redis eval throws', async () => {
    __setRedisClientForTests({
      eval: vi.fn().mockRejectedValue(new Error('redis down')),
    });
    const result = await checkRateLimit('user:fallback', OPTS);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe('rateLimitResponse', () => {
  it('returns a 429 with retry / X-RateLimit headers', async () => {
    const reset = Date.now() + 30_000;
    const res = rateLimitResponse({
      success: false,
      remaining: 0,
      reset,
      limit: 60,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/rate limit/i);
  });

  it('clamps Retry-After to a minimum of 1 second', () => {
    const res = rateLimitResponse({
      success: false,
      remaining: 0,
      reset: Date.now() - 5_000,
      limit: 10,
    });
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
  });
});

describe('RATE_LIMITS presets', () => {
  it('send and broadcast budgets are independent', async () => {
    __resetRateLimitForTests();
    const { RATE_LIMITS } = await import('./rate-limit');
    expect(RATE_LIMITS.send.limit).toBeGreaterThan(RATE_LIMITS.broadcast.limit);
    expect(RATE_LIMITS.send.windowMs).toBe(60_000);
    expect(RATE_LIMITS.broadcast.windowMs).toBe(60_000);
  });
});

afterEach(() => {
  __resetRateLimitForTests();
});
