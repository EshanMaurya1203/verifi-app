// ─── VRF-ONBOARD-001E.12H — Dashboard Caching & Invalidation Layer ─────

import type {
  DashboardCache,
  DashboardCacheEntry,
  DashboardState,
} from "./experiments";

/**
 * Creates an in-memory DashboardCache store.
 */
export function createDashboardCache(): DashboardCache {
  return {
    entries: new Map<string, DashboardCacheEntry>(),
  };
}

/**
 * Determines whether a dashboard cache entry should be invalidated.
 *
 * Rules:
 * - Invalidate when expired (now >= entry.expiresAt)
 * - Do NOT invalidate when alerts change or timestamps differ (unless expired)
 */
export function shouldInvalidateDashboard(
  entry: DashboardCacheEntry
): boolean {
  if (!entry || !entry.expiresAt) {
    return true;
  }
  const now = new Date();
  return now.getTime() >= entry.expiresAt.getTime();
}

/**
 * Retrieves a DashboardState from cache by key if valid and not expired.
 */
export function getCachedDashboard(
  key: string,
  cache: DashboardCache
): DashboardState | null {
  if (!key || !cache || !cache.entries) {
    return null;
  }

  const entry = cache.entries.get(key);
  if (!entry) {
    return null;
  }

  if (shouldInvalidateDashboard(entry)) {
    cache.entries.delete(key);
    return null;
  }

  return entry.state;
}

/**
 * Stores a DashboardCacheEntry into cache.
 */
export function storeDashboard(
  entry: DashboardCacheEntry,
  cache: DashboardCache
): void {
  if (!entry || !entry.key || !cache || !cache.entries) {
    return;
  }
  cache.entries.set(entry.key, entry);
}
