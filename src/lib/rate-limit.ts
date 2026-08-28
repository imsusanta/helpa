/**
 * Per-key rate limiter.
 *
 * Fixed-window counter: every identifier gets a fresh N-request budget
 * each window. When REDIS_URL is configured the counter is shared across
 * instances (required on serverless / multi-node). Without Redis it falls
 * back to an in-process Map so local development and unit tests still work.
 *
 * Call sites always `await checkRateLimit(...)` — the return shape is
 * unchanged so swapping backends is transparent.
 */

import { NextResponse } from 'next/server';

export interface RateLimitOptions {
  /** Max requests allowed in `windowMs`. */
  limit: number;
  /** Window size, milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Unix ms when the bucket refills. */
  reset: number;
  limit: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

interface RedisEvalClient {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
  isOpen?: boolean;
  connect?: () => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

const buckets = new Map<string, Entry>();

const LIGHT_SWEEP_EVERY = 1000;
let callsSinceSweep = 0;
let redisClient: RedisEvalClient | null = null;
let redisConnectPromise: Promise<RedisEvalClient | null> | null = null;
let redisLoggedFailure = false;

const REDIS_INCR_EXPIRE = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

function sweepExpired(now: number) {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

function checkMemory(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= LIGHT_SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: limit - 1,
      reset: now + windowMs,
      limit,
    };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt, limit };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: limit - entry.count,
    reset: entry.resetAt,
    limit,
  };
}

export function redisRateLimitEnabled(): boolean {
  if (!process.env.REDIS_URL) return false;
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return process.env.RATE_LIMIT_USE_REDIS === '1';
  }
  return true;
}

async function getRedisClient(): Promise<RedisEvalClient | null> {
  if (redisClient) return redisClient;
  if (!redisRateLimitEnabled()) return null;
  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    try {
      const { createClient } = await import('redis');
      const client = createClient({
        url: process.env.REDIS_URL,
      }) as RedisEvalClient;
      client.on?.('error', (err: unknown) => {
        if (!redisLoggedFailure) {
          redisLoggedFailure = true;
          console.error(
            '[rate-limit] Redis error, falling back to memory:',
            err
          );
        }
      });
      if (client.connect && !client.isOpen) {
        await client.connect();
      }
      redisClient = client;
      return client;
    } catch (err) {
      if (!redisLoggedFailure) {
        redisLoggedFailure = true;
        console.error(
          '[rate-limit] Redis unavailable, falling back to memory:',
          err
        );
      }
      return null;
    }
  })();

  return redisConnectPromise;
}

async function checkRedis(
  client: RedisEvalClient,
  key: string,
  { limit, windowMs }: RateLimitOptions
): Promise<RateLimitResult | null> {
  try {
    const raw = await client.eval(REDIS_INCR_EXPIRE, {
      keys: [`rl:${key}`],
      arguments: [String(windowMs)],
    });
    const current = Number(Array.isArray(raw) ? raw[0] : 0);
    const ttlMs = Number(Array.isArray(raw) ? raw[1] : windowMs);
    const reset = Date.now() + Math.max(ttlMs, 1);
    if (!Number.isFinite(current) || current <= 0) return null;
    if (current > limit) {
      return { success: false, remaining: 0, reset, limit };
    }
    return {
      success: true,
      remaining: Math.max(0, limit - current),
      reset,
      limit,
    };
  } catch (err) {
    if (!redisLoggedFailure) {
      redisLoggedFailure = true;
      console.error(
        '[rate-limit] Redis eval failed, falling back to memory:',
        err
      );
    }
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (client) {
    const redisResult = await checkRedis(client, key, options);
    if (redisResult) return redisResult;
  }
  return checkMemory(key, options);
}

/**
 * Standard 429 response with the headers clients expect (RFC 6585 +
 * draft-ietf-httpapi-ratelimit-headers). Callers just `return` this.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retry_after_seconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
      },
    }
  );
}

/** Preconfigured budgets, tweak here not at call sites. */
export const RATE_LIMITS = {
  /** Individual message send. 60/min per user = one per second
   *  sustained, comfortable for a live human typing. */
  send: { limit: 60, windowMs: 60_000 },
  /** Broadcast dispatch. 5/min per user — even a 1 000-recipient
   *  broadcast is one call; this caps the rate at which a single user
   *  can launch campaigns, not the messages inside one. */
  broadcast: { limit: 5, windowMs: 60_000 },
  /** Reaction add/swap/remove. More permissive than send — users
   *  fidget with reactions and a single "swap" is actually two calls
   *  (remove + add) under the hood. */
  react: { limit: 120, windowMs: 60_000 },
  /** Invitation peek (public, per-IP). 30/min lets a forwarded link
   *  retry a handful of times under flaky connectivity without
   *  enabling brute-force token enumeration. With 256-bit tokens the
   *  enumeration risk is theoretical; this is belt-and-braces. */
  invitationPeek: { limit: 30, windowMs: 60_000 },
  /** Invitation redeem (authed, per-IP+user). Tighter than peek —
   *  successful redemption mutates two profiles and an invite row, so
   *  the abuse surface is "spam join attempts." */
  invitationRedeem: { limit: 10, windowMs: 60_000 },
  /** Admin-only account / member-management actions: create/revoke
   *  invitation, rename account, change member role, remove member,
   *  transfer ownership. 30/min per user is comfortably above any
   *  realistic legitimate use (the Members tab is a clicks-only UI)
   *  while still bounding accidental abuse from a script run in a
   *  loop or a compromised admin session spamming role flips. */
  adminAction: { limit: 30, windowMs: 60_000 },
  /** WhatsApp QR panel poll. The settings UI refreshes about every
   *  2.5s (~24/min). 60/min leaves room for two open tabs without
   *  sharing the stricter adminAction budget used by connect/delete. */
  whatsappQrPoll: { limit: 60, windowMs: 60_000 },
  /** Patient data export limit. 10/min per user prevents bulk export abuse. */
  patientExport: { limit: 10, windowMs: 60_000 },
  /** Hard deletion limit. 5/min per user prevents mass deletion abuse. */
  patientDelete: { limit: 5, windowMs: 60_000 },
  /** Authentication actions limit. 10/min per IP prevents brute-force login/signup. */
  auth: { limit: 10, windowMs: 60_000 },
} as const;

/** Test-only helper. Clears the in-memory state so unit tests don't
 *  leak buckets across files. Not wired up in production code. */
export function __resetRateLimitForTests() {
  buckets.clear();
  callsSinceSweep = 0;
  redisClient = null;
  redisConnectPromise = null;
  redisLoggedFailure = false;
}

/** Test-only: inject a Redis-like client that implements `eval`. */
export function __setRedisClientForTests(client: RedisEvalClient | null) {
  redisClient = client;
  redisConnectPromise = client ? Promise.resolve(client) : null;
}
