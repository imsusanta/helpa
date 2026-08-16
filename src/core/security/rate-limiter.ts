/**
 * Helpa Core Security — Tenant & IP Rate Limiting
 *
 * Sliding-window rate limiter protecting against brute-force attacks, AI request flooding,
 * and high-volume message loops.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMIT_PROFILES: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 attempts / min
  ai_request: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests / min
  whatsapp_send: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 sends / min
  webhook: { maxRequests: 300, windowMs: 60 * 1000 }, // 300 webhooks / min
  admin_api: { maxRequests: 120, windowMs: 60 * 1000 }, // 120 calls / min
};

/**
 * Checks if a specific key (e.g. `auth:ip_1.2.3.4` or `ai:workspace_abc`) is within rate limits.
 */
export function checkRateLimit(
  key: string,
  profile: keyof typeof RATE_LIMIT_PROFILES = 'ai_request'
): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const config = RATE_LIMIT_PROFILES[profile] || RATE_LIMIT_PROFILES.ai_request;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Filter out timestamps outside current sliding window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = entry.timestamps[0];
    const resetTimeMs = oldestTimestamp + config.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs: Math.max(0, resetTimeMs),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetTimeMs: config.windowMs,
  };
}

/**
 * Clears expired rate limit records periodically to prevent memory leaks.
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(
      (ts) => ts > now - 5 * 60 * 1000
    );
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}
