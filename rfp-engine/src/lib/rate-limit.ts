/**
 * In-memory rate limiting utility
 * Suitable for single-server deployments
 * For scaling, replace with Redis-based implementation
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

// Separate stores for different rate limit contexts
const stores = new Map<string, Map<string, RateLimitRecord>>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function getStore(key: string): Map<string, RateLimitRecord> {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key)!;
}

// Run cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [, store] of stores) {
    for (const [identifier, record] of store) {
      if (record.resetAt < now) {
        store.delete(identifier);
      }
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Check and update rate limit for a given identifier
 */
export function rateLimit(config: {
  key: string;
  identifier: string;
  windowMs: number;
  max: number;
}): RateLimitResult {
  const { key, identifier, windowMs, max } = config;
  const store = getStore(key);
  const now = Date.now();

  const record = store.get(identifier);

  // No existing record or window expired - start fresh
  if (!record || record.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      remaining: max - 1,
      resetAt,
    };
  }

  // Check if limit exceeded
  if (record.count >= max) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  // Increment count
  record.count++;
  return {
    success: true,
    remaining: max - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    ...(result.success ? {} : { "Retry-After": String(Math.max(1, retryAfter)) }),
  };
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  // Project creation: 10 per minute
  projects: (userId: string) =>
    rateLimit({ key: "projects", identifier: userId, windowMs: 60 * 1000, max: 10 }),

  // Requirement updates: 60 per minute
  requirements: (userId: string) =>
    rateLimit({ key: "requirements", identifier: userId, windowMs: 60 * 1000, max: 60 }),

  // Billing checkout: 5 per minute
  checkout: (userId: string) =>
    rateLimit({ key: "checkout", identifier: userId, windowMs: 60 * 1000, max: 5 }),

  // Billing portal: 10 per minute
  portal: (userId: string) =>
    rateLimit({ key: "portal", identifier: userId, windowMs: 60 * 1000, max: 10 }),

  // Data export: 3 per hour
  export: (userId: string) =>
    rateLimit({ key: "export", identifier: userId, windowMs: 60 * 60 * 1000, max: 3 }),

  // Account deletion: 3 per hour
  delete: (userId: string) =>
    rateLimit({ key: "delete", identifier: userId, windowMs: 60 * 60 * 1000, max: 3 }),

  // 2FA regeneration: 5 per hour
  twoFactorRegenerate: (userId: string) =>
    rateLimit({ key: "2fa-regenerate", identifier: userId, windowMs: 60 * 60 * 1000, max: 5 }),
};
