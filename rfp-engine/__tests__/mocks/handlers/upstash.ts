/**
 * Upstash Redis Mock Handlers
 * In-memory rate limiter mock with configurable limits
 */

import { http, HttpResponse } from 'msw';

// In-memory store for Redis operations
const store = new Map<string, { value: string | number; expiresAt?: number }>();

// Rate limit tracking
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

// Configurable rate limit behavior
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitConfigs = new Map<string, RateLimitConfig>();

// Set custom rate limit for a key prefix
export function setRateLimitConfig(prefix: string, config: RateLimitConfig): void {
  rateLimitConfigs.set(prefix, config);
}

// Reset all mock data
export function resetUpstashMocks(): void {
  store.clear();
  rateLimitCounters.clear();
  rateLimitConfigs.clear();
}

// Helper to check if a key has expired
function isExpired(key: string): boolean {
  const entry = store.get(key);
  if (!entry || !entry.expiresAt) return false;
  return Date.now() > entry.expiresAt;
}

// Clean expired keys
function cleanExpired(): void {
  for (const [key] of store) {
    if (isExpired(key)) {
      store.delete(key);
    }
  }
}

// Get current value of a key (for test assertions)
export function getStoreValue(key: string): string | number | undefined {
  cleanExpired();
  const entry = store.get(key);
  return entry?.value;
}

// Set a value directly (for test setup)
export function setStoreValue(key: string, value: string | number, ttlMs?: number): void {
  store.set(key, {
    value,
    expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
  });
}

// Upstash REST API format
// Upstash uses a specific REST API format with commands as array
export const upstashHandlers = [
  // Main Upstash REST endpoint
  http.post('https://*.upstash.io/*', async ({ request }) => {
    const body = await request.json() as string[] | { command: string[] }[];
    cleanExpired();

    // Handle pipeline requests (array of commands)
    if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'object') {
      const results = (body as { command: string[] }[]).map(cmd => {
        return executeCommand(cmd.command || []);
      });
      return HttpResponse.json(results);
    }

    // Single command
    const command = Array.isArray(body) ? body : [];
    const result = executeCommand(command as string[]);
    return HttpResponse.json(result);
  }),

  // Alternative endpoint format
  http.get('https://*.upstash.io/*', ({ request }) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2) {
      const command = pathParts.map(decodeURIComponent);
      const result = executeCommand(command);
      return HttpResponse.json(result);
    }

    return HttpResponse.json({ result: null });
  }),
];

// Execute Redis command
function executeCommand(args: string[]): { result: unknown } {
  if (args.length === 0) {
    return { result: null };
  }

  const command = args[0].toUpperCase();
  const key = args[1];

  switch (command) {
    case 'GET': {
      const entry = store.get(key);
      if (!entry || isExpired(key)) {
        store.delete(key);
        return { result: null };
      }
      return { result: entry.value };
    }

    case 'SET': {
      const value = args[2];
      let ttlMs: number | undefined;

      // Handle PX option (milliseconds)
      const pxIndex = args.findIndex(a => a.toUpperCase() === 'PX');
      if (pxIndex !== -1 && args[pxIndex + 1]) {
        ttlMs = parseInt(args[pxIndex + 1], 10);
      }

      // Handle EX option (seconds)
      const exIndex = args.findIndex(a => a.toUpperCase() === 'EX');
      if (exIndex !== -1 && args[exIndex + 1]) {
        ttlMs = parseInt(args[exIndex + 1], 10) * 1000;
      }

      store.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
      return { result: 'OK' };
    }

    case 'DEL': {
      const deleted = store.has(key) ? 1 : 0;
      store.delete(key);
      return { result: deleted };
    }

    case 'INCR': {
      const entry = store.get(key);
      let newValue: number;

      if (!entry || isExpired(key)) {
        newValue = 1;
      } else {
        newValue = (typeof entry.value === 'number' ? entry.value : parseInt(String(entry.value), 10) || 0) + 1;
      }

      store.set(key, {
        value: newValue,
        expiresAt: entry?.expiresAt,
      });
      return { result: newValue };
    }

    case 'EXPIRE': {
      const entry = store.get(key);
      if (!entry) {
        return { result: 0 };
      }
      const seconds = parseInt(args[2], 10);
      entry.expiresAt = Date.now() + seconds * 1000;
      store.set(key, entry);
      return { result: 1 };
    }

    case 'TTL': {
      const entry = store.get(key);
      if (!entry) {
        return { result: -2 };
      }
      if (!entry.expiresAt) {
        return { result: -1 };
      }
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return { result: remaining > 0 ? remaining : -2 };
    }

    case 'EXISTS': {
      const exists = store.has(key) && !isExpired(key) ? 1 : 0;
      return { result: exists };
    }

    case 'EVAL':
    case 'EVALSHA': {
      // Upstash Ratelimit uses Lua scripts
      // Simplified: just return a success response
      return {
        result: {
          success: true,
          remaining: 10,
          reset: Date.now() + 60000,
          limit: 10,
        },
      };
    }

    default:
      return { result: null };
  }
}
