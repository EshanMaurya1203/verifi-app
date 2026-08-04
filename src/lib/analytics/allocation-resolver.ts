// ─── VRF-ONBOARD-001E.12C.1 — Traffic Allocation Resolver ─────────────

import type { ExperimentVariant } from "./experiments";
import { validateAllocations } from "./experiment-validators";

/**
 * Resolves a bucket (0–99) to a specific ExperimentVariant based on variant allocations.
 *
 * Example: 50% / 30% / 20%
 *   Bucket 0–49   → Variant A
 *   Bucket 50–79  → Variant B
 *   Bucket 80–99  → Variant C
 *
 * @throws {Error} if bucket is out of bounds (not 0–99) or allocations fail validation.
 */
export function resolveVariant(
  bucket: number,
  variants: ExperimentVariant[]
): ExperimentVariant {
  if (typeof bucket !== "number" || isNaN(bucket) || bucket < 0 || bucket >= 100) {
    throw new Error(`Bucket must be an integer between 0 and 99 (got ${bucket}).`);
  }

  const validation = validateAllocations(variants || []);
  if (!validation.valid) {
    throw new Error(`Invalid variant allocations: ${validation.reason}`);
  }

  let cumulativeBucket = 0;
  for (const variant of variants) {
    const rangeEnd = cumulativeBucket + variant.allocation;
    if (bucket >= cumulativeBucket && bucket < rangeEnd) {
      return variant;
    }
    cumulativeBucket = rangeEnd;
  }

  // Edge case fallback (e.g., floating point rounding boundary): return last variant
  return variants[variants.length - 1];
}
