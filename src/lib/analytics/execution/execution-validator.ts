/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-005C — Deployment Executor Validator ────────────────────────

import type { RolloutPlan } from "../rollout/rollout-types";
import type { ExecutionHistoryEntry, ExecutionPolicy } from "./execution-types";

export interface ExecutionValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates an execution request.
 * Rules:
 * 1. rolloutPlan required with non-empty experimentId.
 * 2. previousHistory entries sequence numbers strictly monotonic (e.g. 1 < 2 < 3...).
 * 3. Optional policy validation: rolloutStages strictly increasing array ending in 100 with percentages in [0, 100].
 */
export function validateExecutionRequest(
  rolloutPlan: RolloutPlan,
  previousHistory: readonly ExecutionHistoryEntry[],
  policy?: Partial<ExecutionPolicy>
): ExecutionValidationResult {
  const errors: string[] = [];

  if (!rolloutPlan || typeof rolloutPlan !== "object") {
    return { passed: false, errors: ["RolloutPlan payload is required."] };
  }

  if (!rolloutPlan.experimentId || typeof rolloutPlan.experimentId !== "string" || rolloutPlan.experimentId.trim() === "") {
    errors.push("RolloutPlan requires a valid non-empty experimentId.");
  }

  if (!rolloutPlan.action) {
    errors.push("RolloutPlan requires a valid action.");
  }

  if (previousHistory && Array.isArray(previousHistory)) {
    for (let i = 0; i < previousHistory.length; i++) {
      const entry = previousHistory[i];
      if (!entry || typeof entry.sequence !== "number" || isNaN(entry.sequence)) {
        errors.push(`History entry at index ${i} has invalid sequence number.`);
      } else if (i > 0) {
        const prevEntry = previousHistory[i - 1];
        if (entry.sequence <= prevEntry.sequence) {
          errors.push(
            `History sequence numbers must be strictly monotonic (index ${i} seq ${entry.sequence} <= prev seq ${prevEntry.sequence}).`
          );
        }
      }
    }
  }

  if (policy) {
    if (policy.rolloutStages !== undefined) {
      if (!Array.isArray(policy.rolloutStages) || policy.rolloutStages.length === 0) {
        errors.push("Policy rolloutStages must be a non-empty array of numbers.");
      } else {
        const stages = policy.rolloutStages;
        for (let i = 0; i < stages.length; i++) {
          const val = stages[i];
          if (typeof val !== "number" || isNaN(val) || val < 0 || val > 100) {
            errors.push(`Policy rolloutStage at index ${i} must be a number between 0 and 100.`);
          }
          if (i > 0 && val <= stages[i - 1]) {
            errors.push(`Policy rolloutStages must be strictly increasing (${val} <= ${stages[i - 1]}).`);
          }
        }
        if (stages[stages.length - 1] !== 100) {
          errors.push(`Policy rolloutStages final stage must equal 100 (got ${stages[stages.length - 1]}).`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
