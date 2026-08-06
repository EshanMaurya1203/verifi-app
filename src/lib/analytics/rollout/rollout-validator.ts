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
// ─── VRF-ONBOARD-005B — Rollout Validator ────────────────────────────────────

import type { DecisionReport } from "../decision/decision-types";
import type { RolloutPolicy } from "./rollout-types";

export interface RolloutValidationResult {
  passed: boolean;
  errors: string[];
}

const VALID_DECISIONS = new Set([
  "continue",
  "winner_detected",
  "regression_detected",
  "inconclusive",
  "insufficient_sample",
]);

/**
 * Validates a rollout plan request.
 * Rules:
 * 1. decision payload required with valid decision state.
 * 2. baselineVariantId non-empty string matching decision.baselineVariantId.
 * 3. candidateVariantId non-empty string matching decision.candidateVariantId.
 * 4. Optional policy validation: percentages between 0 and 100.
 */
export function validateRolloutRequest(
  decision: DecisionReport,
  baselineVariantId: string,
  candidateVariantId: string,
  policy?: Partial<RolloutPolicy>
): RolloutValidationResult {
  const errors: string[] = [];

  if (!decision || typeof decision !== "object") {
    return { passed: false, errors: ["DecisionReport payload is required."] };
  }

  if (!decision.experimentId || typeof decision.experimentId !== "string" || decision.experimentId.trim() === "") {
    errors.push("DecisionReport requires a valid non-empty experimentId.");
  }

  if (!decision.decision || !VALID_DECISIONS.has(decision.decision)) {
    errors.push(`DecisionReport has invalid decision state '${decision.decision}'.`);
  }

  if (!baselineVariantId || typeof baselineVariantId !== "string" || baselineVariantId.trim() === "") {
    errors.push("baselineVariantId is required.");
  } else if (decision.baselineVariantId && baselineVariantId.trim() !== decision.baselineVariantId.trim()) {
    errors.push(`baselineVariantId '${baselineVariantId}' does not match decision baselineVariantId '${decision.baselineVariantId}'.`);
  }

  if (!candidateVariantId || typeof candidateVariantId !== "string" || candidateVariantId.trim() === "") {
    errors.push("candidateVariantId is required.");
  } else if (decision.candidateVariantId && candidateVariantId.trim() !== decision.candidateVariantId.trim()) {
    errors.push(`candidateVariantId '${candidateVariantId}' does not match decision candidateVariantId '${decision.candidateVariantId}'.`);
  }

  if (policy) {
    if (policy.winnerTrafficPercentage !== undefined) {
      if (typeof policy.winnerTrafficPercentage !== "number" || isNaN(policy.winnerTrafficPercentage) || policy.winnerTrafficPercentage < 0 || policy.winnerTrafficPercentage > 100) {
        errors.push("Policy winnerTrafficPercentage must be a number between 0 and 100.");
      }
    }
    if (policy.rollbackTrafficPercentage !== undefined) {
      if (typeof policy.rollbackTrafficPercentage !== "number" || isNaN(policy.rollbackTrafficPercentage) || policy.rollbackTrafficPercentage < 0 || policy.rollbackTrafficPercentage > 100) {
        errors.push("Policy rollbackTrafficPercentage must be a number between 0 and 100.");
      }
    }
    if (policy.archiveOnRegression !== undefined && typeof policy.archiveOnRegression !== "boolean") {
      errors.push("Policy archiveOnRegression must be a boolean.");
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
