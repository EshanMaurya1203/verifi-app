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
// ─── VRF-ONBOARD-005B — Rollout Projections Module ───────────────────────────

import type { TrafficAllocation, RolloutPlan, RolloutResult } from "./rollout-types";

/**
 * Projects a deeply frozen TrafficAllocation structure.
 */
export function projectTrafficAllocation(allocation: TrafficAllocation): Readonly<TrafficAllocation> {
  return Object.freeze({
    baselineVariantId: allocation.baselineVariantId,
    candidateVariantId: allocation.candidateVariantId,
    baselinePercentage: allocation.baselinePercentage,
    candidatePercentage: allocation.candidatePercentage,
  });
}

/**
 * Projects a deeply frozen RolloutPlan structure.
 */
export function projectRolloutPlan(plan: RolloutPlan): Readonly<RolloutPlan> {
  return Object.freeze({
    experimentId: plan.experimentId,
    action: plan.action,
    allocation: projectTrafficAllocation(plan.allocation),
    reasonCode: plan.reasonCode,
    decision: plan.decision,
  });
}

/**
 * Projects a deeply frozen RolloutResult structure.
 */
export function projectRolloutResult(res: RolloutResult): Readonly<RolloutResult> {
  return Object.freeze({
    plan: projectRolloutPlan(res.plan),
  });
}
