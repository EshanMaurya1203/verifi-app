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
// ─── VRF-ONBOARD-005B — Rollout Engine Module ────────────────────────────────

import { RolloutValidationError } from "./rollout-errors";
import type { DecisionReport } from "../decision/decision-types";
import type { RolloutPolicy, RolloutAction, RolloutPlan, RolloutResult } from "./rollout-types";
import { DEFAULT_ROLLOUT_POLICY, ROLLOUT_REASON_CODES, buildTrafficAllocation } from "./rollout-utils";
import { validateRolloutRequest } from "./rollout-validator";

/**
 * Deterministically generates a RolloutPlan based on a DecisionReport and RolloutPolicy.
 *
 * CONTROLLED EXECUTION / PLANNER CONSTRAINTS:
 * 1. Executes rollout policies only.
 * 2. NEVER computes analytics, significance, or decisions.
 * 3. Contains zero database writes, APIs, network calls, notifications, or automatic deployment.
 *
 * Rules:
 * - RULE 1: insufficient_sample -> keep_running (50/50)
 * - RULE 2: inconclusive -> keep_running (50/50)
 * - RULE 3: winner_detected -> increase_traffic (25/75 default)
 * - RULE 4: regression_detected & archiveOnRegression=false -> decrease_traffic (90/10 default)
 * - RULE 5: continue -> keep_running (50/50)
 * - RULE 6: regression_detected & archiveOnRegression=true -> archive_experiment (100/0)
 */
export function buildRolloutPlan(
  decision: DecisionReport,
  baselineVariantId: string,
  candidateVariantId: string,
  policy?: Partial<RolloutPolicy>
): RolloutResult {
  const validation = validateRolloutRequest(decision, baselineVariantId, candidateVariantId, policy);
  if (!validation.passed) {
    throw new RolloutValidationError(
      `Invalid rollout request: ${validation.errors.join("; ")}`
    );
  }

  const effectivePolicy: RolloutPolicy = {
    winnerTrafficPercentage: policy?.winnerTrafficPercentage ?? DEFAULT_ROLLOUT_POLICY.winnerTrafficPercentage,
    rollbackTrafficPercentage: policy?.rollbackTrafficPercentage ?? DEFAULT_ROLLOUT_POLICY.rollbackTrafficPercentage,
    archiveOnRegression: policy?.archiveOnRegression ?? DEFAULT_ROLLOUT_POLICY.archiveOnRegression,
  };

  const bId = baselineVariantId.trim();
  const cId = candidateVariantId.trim();

  let action: RolloutAction = "keep_running";
  let allocation = buildTrafficAllocation(bId, cId, 50);
  let reasonCode: string = ROLLOUT_REASON_CODES.KEEP_RUNNING_CONTINUE;

  switch (decision.decision) {
    case "insufficient_sample":
      action = "keep_running";
      allocation = buildTrafficAllocation(bId, cId, 50);
      reasonCode = ROLLOUT_REASON_CODES.KEEP_RUNNING_INSUFFICIENT_SAMPLE;
      break;
    case "inconclusive":
      action = "keep_running";
      allocation = buildTrafficAllocation(bId, cId, 50);
      reasonCode = ROLLOUT_REASON_CODES.KEEP_RUNNING_INCONCLUSIVE;
      break;
    case "winner_detected":
      action = "increase_traffic";
      allocation = buildTrafficAllocation(bId, cId, effectivePolicy.winnerTrafficPercentage);
      reasonCode = ROLLOUT_REASON_CODES.INCREASE_TRAFFIC_WINNER_DETECTED;
      break;
    case "regression_detected":
      if (effectivePolicy.archiveOnRegression) {
        action = "archive_experiment";
        allocation = buildTrafficAllocation(bId, cId, 0);
        reasonCode = ROLLOUT_REASON_CODES.ARCHIVE_EXPERIMENT_REGRESSION_DETECTED;
      } else {
        action = "decrease_traffic";
        allocation = buildTrafficAllocation(bId, cId, effectivePolicy.rollbackTrafficPercentage);
        reasonCode = ROLLOUT_REASON_CODES.DECREASE_TRAFFIC_REGRESSION_DETECTED;
      }
      break;
    case "continue":
    default:
      action = "keep_running";
      allocation = buildTrafficAllocation(bId, cId, 50);
      reasonCode = ROLLOUT_REASON_CODES.KEEP_RUNNING_CONTINUE;
      break;
  }

  const plan: RolloutPlan = Object.freeze({
    experimentId: decision.experimentId.trim(),
    action,
    allocation,
    reasonCode,
    decision: decision.decision,
  });

  return Object.freeze({
    plan,
  });
}
