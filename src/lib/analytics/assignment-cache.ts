// ─── VRF-ONBOARD-001E.12C.2C — Assignment Cache & Hardened Invalidation Rules ────

import type { Experiment, IdentifierType, VariantAssignment } from "./experiments";
import { computeAssignmentHash } from "./hash";

export interface AssignmentCacheEntry {
  deterministicKey: string;
  assignment: VariantAssignment;
  cachedAt: Date;
  expiresAt: Date;
}

export interface AssignmentCache {
  entries: Map<string, AssignmentCacheEntry>;
}

export interface CacheValidationContext {
  identifier: string;
  identifierType: IdentifierType;
  experiment: Experiment;
}

/**
 * Creates an empty in-memory AssignmentCache instance.
 */
export function createAssignmentCache(): AssignmentCache {
  return {
    entries: new Map<string, AssignmentCacheEntry>(),
  };
}

/**
 * Retrieves a cached assignment by deterministicKey if non-expired.
 * Returns null on cache miss or expiration.
 */
export function getCachedAssignment(
  deterministicKey: string,
  cache: AssignmentCache
): VariantAssignment | null {
  if (!cache || !cache.entries || !deterministicKey) {
    return null;
  }

  const entry = cache.entries.get(deterministicKey);
  if (!entry) {
    return null;
  }

  // Check TTL expiration
  if (new Date() >= entry.expiresAt) {
    return null;
  }

  return entry.assignment;
}

/**
 * Stores an assignment entry in the cache keyed by deterministicKey.
 */
export function storeCachedAssignment(
  entry: AssignmentCacheEntry,
  cache: AssignmentCache
): void {
  if (!cache || !cache.entries || !entry || !entry.deterministicKey) {
    return;
  }
  cache.entries.set(entry.deterministicKey, entry);
}

/**
 * Determines whether a cache entry must be invalidated.
 *
 * Invalidation triggers:
 * 1. experimentVersion changed
 * 2. experimentId changed
 * 3. entry expired (now >= expiresAt)
 * 4. assignmentHash mismatch (recomputed hash differs from cached assignmentHash)
 *
 * Guaranteed NOT to invalidate:
 * ✓ Differences in timestamps alone (assignedAt / cachedAt)
 */
export function shouldInvalidateCache(
  cacheEntry: AssignmentCacheEntry,
  context: CacheValidationContext
): boolean {
  if (!cacheEntry || !cacheEntry.assignment || !context || !context.experiment) {
    return true;
  }

  const { experiment, identifier } = context;

  // 1. Version change
  if (cacheEntry.assignment.experimentVersion !== experiment.version) {
    return true;
  }

  // 2. Experiment ID mismatch
  if (cacheEntry.assignment.experimentId !== experiment.id) {
    return true;
  }

  // 3. Expiry
  if (new Date() >= cacheEntry.expiresAt) {
    return true;
  }

  // 4. Hash mismatch (recompute expected hash for identifier + experimentId + version)
  if (identifier && identifier.trim() !== "") {
    const expectedHash = computeAssignmentHash(
      identifier,
      experiment.id,
      experiment.version
    ).hash;

    if (cacheEntry.assignment.assignmentHash !== expectedHash) {
      return true;
    }
  }

  return false;
}
