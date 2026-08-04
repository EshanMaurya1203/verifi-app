import type { TimeRange } from "./types";
import type { AnalyticsFilters } from "./filters";

// ─── Cache Constants & Types ──────────────────────────────────────────

export type AnalyticsCacheKey = "analytics" | "trends" | "comparison" | "diagnostics" | "recovery" | "recommendations";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export const ANALYTICS_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const TRENDS_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const COMPARISON_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const DIAGNOSTICS_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RECOVERY_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RECOMMENDATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── In-Memory Storage ────────────────────────────────────────────────

// ARCHITECTURE NOTE (ADR-030):
// This cache is process-local — each serverless function instance maintains
// its own independent Map. In environments like Vercel, where instances are
// ephemeral and may be recycled at any time, cache hits are best-effort.
// Multiple concurrent instances will NOT share cached values.
//
// This is acceptable for admin analytics because:
//   1. Analytics data is not mission-critical.
//   2. A cache miss simply results in a fresh database query.
//   3. Short TTLs (5–10 min) limit staleness.
//
// Future evolution: migrate to Redis or Upstash for cross-instance shared
// caching without changing the public getCachedValue / setCachedValue API.
const cache = new Map<string, CacheEntry<unknown>>();

// ─── Cache Utility Functions ──────────────────────────────────────────

/**
 * Formats a standardized cache key string (e.g. "analytics:7d:all:all").
 */
export function getCacheKey(
  type: AnalyticsCacheKey,
  range: TimeRange,
  filters: AnalyticsFilters
): string {
  return `${type}:${range}:${filters.provider}:${filters.outcome}`;
}

/**
 * Retrieves a cached value if present and unexpired.
 * Deletes expired entries automatically.
 */
export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

/**
 * Stores a value in the in-memory cache with an expiration timestamp.
 */
export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = Date.now() + ttlMs;
  cache.set(key, { value, expiresAt });
}

/**
 * Clears all cached analytics entries.
 *
 * TODO: Wire cache invalidation into analytics event pipeline when onboarding
 * events, completions, draft restores/discards, or verifications occur.
 */
export function invalidateAnalyticsCache(): void {
  cache.clear();
}
