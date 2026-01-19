/**
 * Redis-based rate limiting utility using Upstash
 * Provides distributed rate limiting that works across serverless instances
 * Falls back to allowing requests if Redis is unavailable (with warning)
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit?: number;
}

interface LoginRateLimitResult {
  allowed: boolean;
  message?: string;
  lockedUntil?: number;
}

// =============================================================================
// REDIS CLIENT
// =============================================================================

// Lazy-initialized Redis client (avoids errors when env vars not set during build)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. " +
      "Rate limiting disabled - all requests will be allowed."
    );
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// =============================================================================
// UPSTASH RATE LIMITERS
// =============================================================================

// Cache rate limiter instances to avoid recreating them
const rateLimiterCache = new Map<string, Ratelimit>();

function getRateLimiter(prefix: string, windowMs: number, max: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;

  const cacheKey = `${prefix}:${windowMs}:${max}`;
  if (rateLimiterCache.has(cacheKey)) {
    return rateLimiterCache.get(cacheKey)!;
  }

  // Use sliding window algorithm for smooth rate limiting
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    prefix: `rl:${prefix}`,
    analytics: false, // Disable analytics to reduce Redis calls
  });

  rateLimiterCache.set(cacheKey, limiter);
  return limiter;
}

// =============================================================================
// CORE RATE LIMIT FUNCTION
// =============================================================================

/**
 * Check and update rate limit for a given identifier
 * Returns success=true if request is allowed, false if rate limited
 */
export async function rateLimit(config: {
  key: string;
  identifier: string;
  windowMs: number;
  max: number;
}): Promise<RateLimitResult> {
  const { key, identifier, windowMs, max } = config;
  const limiter = getRateLimiter(key, windowMs, max);

  // Graceful fallback: if Redis unavailable, allow request
  if (!limiter) {
    return {
      success: true,
      remaining: max,
      resetAt: Date.now() + windowMs,
      limit: max,
    };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
      limit: result.limit,
    };
  } catch (error) {
    // Redis error - allow request but log warning
    console.warn("[rate-limit] Redis error, allowing request:", error);
    return {
      success: true,
      remaining: max,
      resetAt: Date.now() + windowMs,
      limit: max,
    };
  }
}

// =============================================================================
// LOGIN RATE LIMITING WITH LOCKOUT
// =============================================================================

const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check login rate limit with lockout support
 * This is separate from general rate limiting because it needs lockout logic
 */
export async function checkLoginRateLimit(email: string): Promise<LoginRateLimitResult> {
  const client = getRedis();
  const key = email.toLowerCase().trim();

  // Graceful fallback: if Redis unavailable, allow request
  if (!client) {
    return { allowed: true };
  }

  try {
    const lockoutKey = `login:lockout:${key}`;
    const attemptsKey = `login:attempts:${key}`;

    // Check if account is locked out
    const lockedUntil = await client.get<number>(lockoutKey);
    if (lockedUntil && lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
      return {
        allowed: false,
        message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
        lockedUntil,
      };
    }

    // Get current attempt count
    const attempts = await client.get<number>(attemptsKey) || 0;

    // Check if max attempts reached
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock the account
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      await client.set(lockoutKey, lockUntil, { px: LOCKOUT_DURATION_MS });
      // Reset attempts counter
      await client.del(attemptsKey);

      return {
        allowed: false,
        message: "Too many failed attempts. Account temporarily locked for 15 minutes.",
        lockedUntil: lockUntil,
      };
    }

    // Increment attempt count with expiry
    await client.incr(attemptsKey);
    await client.expire(attemptsKey, Math.ceil(LOGIN_RATE_LIMIT_WINDOW_MS / 1000));

    return { allowed: true };
  } catch (error) {
    // Redis error - allow request but log warning
    console.warn("[rate-limit] Redis error during login rate limit check:", error);
    return { allowed: true };
  }
}

/**
 * Reset login attempts on successful login
 */
export async function resetLoginAttempts(email: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = email.toLowerCase().trim();
  try {
    await client.del(`login:attempts:${key}`);
    await client.del(`login:lockout:${key}`);
  } catch (error) {
    // Non-critical - just log
    console.warn("[rate-limit] Failed to reset login attempts:", error);
  }
}

// =============================================================================
// 2FA CHALLENGE RATE LIMITING
// =============================================================================

const MAX_2FA_ATTEMPTS = 5;
const LOCKOUT_2FA_DURATION_MS = 15 * 60 * 1000;

/**
 * Check 2FA challenge rate limit
 */
export async function check2FARateLimit(userId: string): Promise<{ allowed: boolean; remainingAttempts?: number }> {
  const client = getRedis();

  // Graceful fallback
  if (!client) {
    return { allowed: true, remainingAttempts: MAX_2FA_ATTEMPTS };
  }

  try {
    const attemptsKey = `2fa:attempts:${userId}`;
    const attempts = await client.get<number>(attemptsKey) || 0;

    if (attempts >= MAX_2FA_ATTEMPTS) {
      return { allowed: false };
    }

    // Increment
    await client.incr(attemptsKey);
    await client.expire(attemptsKey, Math.ceil(LOCKOUT_2FA_DURATION_MS / 1000));

    return { allowed: true, remainingAttempts: MAX_2FA_ATTEMPTS - attempts - 1 };
  } catch (error) {
    console.warn("[rate-limit] Redis error during 2FA rate limit check:", error);
    return { allowed: true, remainingAttempts: MAX_2FA_ATTEMPTS };
  }
}

/**
 * Clear 2FA rate limit on success
 */
export async function clear2FARateLimit(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(`2fa:attempts:${userId}`);
  } catch (error) {
    console.warn("[rate-limit] Failed to clear 2FA rate limit:", error);
  }
}

// =============================================================================
// RESPONSE HEADERS
// =============================================================================

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return {
    "X-RateLimit-Limit": String(result.limit || 0),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    ...(result.success ? {} : { "Retry-After": String(Math.max(1, retryAfter)) }),
  };
}

// =============================================================================
// PRE-CONFIGURED RATE LIMITERS
// =============================================================================

// Helper to create async rate limiter functions
function createRateLimiter(key: string, windowMs: number, max: number) {
  return (identifier: string) => rateLimit({ key, identifier, windowMs, max });
}

export const rateLimiters = {
  // Project creation: 10 per minute
  projects: createRateLimiter("projects", 60 * 1000, 10),

  // Requirement updates: 60 per minute
  requirements: createRateLimiter("requirements", 60 * 1000, 60),

  // Billing checkout: 5 per hour
  checkout: createRateLimiter("checkout", 60 * 60 * 1000, 5),

  // Billing portal: 10 per minute
  portal: createRateLimiter("portal", 60 * 1000, 10),

  // Data export: 3 per hour
  export: createRateLimiter("export", 60 * 60 * 1000, 3),

  // Account deletion: 3 per hour
  delete: createRateLimiter("delete", 60 * 60 * 1000, 3),

  // 2FA regeneration: 5 per hour
  twoFactorRegenerate: createRateLimiter("2fa-regenerate", 60 * 60 * 1000, 5),

  // 2FA setup: 5 per hour
  twoFactorSetup: createRateLimiter("2fa-setup", 60 * 60 * 1000, 5),

  // 2FA verify: 5 per 15 minutes
  twoFactorVerify: createRateLimiter("2fa-verify", 15 * 60 * 1000, 5),

  // 2FA disable: 5 per hour
  twoFactorDisable: createRateLimiter("2fa-disable", 60 * 60 * 1000, 5),

  // Password change: 5 per hour
  passwordChange: createRateLimiter("password-change", 60 * 60 * 1000, 5),

  // Signup: 5 per minute per IP
  signup: createRateLimiter("signup", 60 * 1000, 5),

  // Email verification resend: 3 per hour
  emailVerificationResend: createRateLimiter("email-verification-resend", 60 * 60 * 1000, 3),
};
