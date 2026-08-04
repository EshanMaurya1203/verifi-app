import type { Recommendation } from "./recommendations";

// ─── Conflict Registry ────────────────────────────────────────────────
// Single source of truth for all recommendation conflict pairs.
// Both directions are indexed automatically — developers only need to
// declare each conflict pair once. Order does not matter.

export interface ConflictPair {
  left: string;
  right: string;
}

export const CONFLICTS: ConflictPair[] = [
  {
    left: "reduce_verification",
    right: "increase_verification",
  },
  {
    left: "reduce_verification_steps",
    right: "increase_verification_checks",
  },
];

// Pre-compute a Set of normalized conflict keys for O(1) lookup.
const conflictIndex = new Set<string>();

/**
 * Validates the CONFLICTS registry for integrity:
 * 1. Checks that no pair defines a self-conflict (left === right).
 * 2. Checks that no duplicate or inverse conflict pairs exist.
 *
 * Throws an Error if validation fails.
 */
export function validateConflictRegistry(): void {
  const seenPairs = new Set<string>();

  for (const pair of CONFLICTS) {
    if (!pair.left || !pair.right) {
      throw new Error(
        `Invalid conflict pair: both left and right recommendation IDs must be non-empty.`
      );
    }

    if (pair.left === pair.right) {
      throw new Error(
        `Invalid conflict pair: self-conflict detected for '${pair.left}'.`
      );
    }

    const forwardKey = `${pair.left}|${pair.right}`;
    const inverseKey = `${pair.right}|${pair.left}`;

    if (seenPairs.has(forwardKey) || seenPairs.has(inverseKey)) {
      throw new Error(
        `Invalid conflict pair: duplicate conflict detected between '${pair.left}' and '${pair.right}'.`
      );
    }

    seenPairs.add(forwardKey);
  }
}

// Build index & run validation at module initialization
validateConflictRegistry();

for (const pair of CONFLICTS) {
  conflictIndex.add(`${pair.left}|${pair.right}`);
  conflictIndex.add(`${pair.right}|${pair.left}`);
}

/**
 * Determines whether two recommendations are in conflict using the centralized registry.
 * Conflict matching is symmetric: areConflicting(A, B) === areConflicting(B, A).
 */
export function areConflicting(
  a: Recommendation,
  b: Recommendation
): boolean {
  if (!a || !b || !a.id || !b.id) return false;
  return conflictIndex.has(`${a.id}|${b.id}`);
}
