/**
 * In-memory sliding-window rate limiter for paid and resource-heavy endpoints (BUG-03).
 * Tracks request timestamps per key (user email or client IP) with automatic garbage collection.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const cache = new Map<string, RateLimitRecord>();

// Periodically clean up entries with empty/expired timestamps every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  cache.forEach((record, key) => {
    record.timestamps = record.timestamps.filter((ts: number) => now - ts < maxWindowMs);
    if (record.timestamps.length === 0) {
      cache.delete(key);
    }
  });
}

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60,000ms = 1 minute) */
  windowMs?: number;
  /** Maximum number of requests allowed within the window (default: 20) */
  maxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 20;
  const now = Date.now();

  cleanupExpired(now, windowMs);

  let record = cache.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    cache.set(identifier, record);
  }

  // Remove timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts: number) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetMs: windowMs,
  };
}
