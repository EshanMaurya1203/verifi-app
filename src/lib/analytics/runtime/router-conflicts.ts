// ─── VRF-ONBOARD-002B — Router Conflict Detector ─────────────────────────

import type { RouterResult, RuntimeExperiment } from "./router-types";

/**
 * Detects mutual exclusion conflicts between candidate experiment and already assigned experiments.
 *
 * Rules:
 * - If experiment A excludes experiment B, and experiment B has already been assigned,
 *   experiment A cannot run (returns true).
 */
export function detectConflict(
  experiment: RuntimeExperiment,
  assigned: RouterResult[]
): boolean {
  if (!experiment || !assigned || assigned.length === 0) {
    return false;
  }

  const assignedExperimentIds = new Set(assigned.map((a) => a.experimentId));

  // 1. Direct Exclusion: experiment excludes any already assigned experiment
  if (experiment.mutuallyExclusiveWith && experiment.mutuallyExclusiveWith.length > 0) {
    for (const excludedId of experiment.mutuallyExclusiveWith) {
      if (assignedExperimentIds.has(excludedId)) {
        return true;
      }
    }
  }

  return false;
}
