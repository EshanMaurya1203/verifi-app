// ─── VRF-ONBOARD-001E.12C.2B — Cache Consistency Validator ─────────────

import type { VariantAssignment } from "./experiments";

export interface CacheConsistencyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates consistency between a cached VariantAssignment and a fresh recomputed VariantAssignment.
 *
 * Requirements:
 * ✓ variantId equal
 * ✓ assignmentHash equal
 * ✓ experimentVersion equal
 * ✓ assignmentReason equal
 */
export function validateCacheConsistency(
  cached: VariantAssignment,
  recomputed: VariantAssignment
): CacheConsistencyResult {
  if (!cached || !recomputed) {
    return {
      valid: false,
      reason: "Both cached and recomputed assignments must be provided.",
    };
  }

  if (cached.variantId !== recomputed.variantId) {
    return {
      valid: false,
      reason: `Cache consistency mismatch: variantId '${cached.variantId}' vs recomputed '${recomputed.variantId}'.`,
    };
  }

  if (cached.assignmentHash !== recomputed.assignmentHash) {
    return {
      valid: false,
      reason: `Cache consistency mismatch: assignmentHash '${cached.assignmentHash}' vs recomputed '${recomputed.assignmentHash}'.`,
    };
  }

  if (cached.experimentVersion !== recomputed.experimentVersion) {
    return {
      valid: false,
      reason: `Cache consistency mismatch: experimentVersion ${cached.experimentVersion} vs recomputed ${recomputed.experimentVersion}.`,
    };
  }

  if (cached.assignmentReason !== recomputed.assignmentReason) {
    return {
      valid: false,
      reason: `Cache consistency mismatch: assignmentReason '${cached.assignmentReason}' vs recomputed '${recomputed.assignmentReason}'.`,
    };
  }

  return { valid: true };
}
