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
// ─── VRF-ONBOARD-005C — Deployment Executor Utils ───────────────────────────

import type { ExecutionPolicy, ExecutionStage, ExecutionHistoryEntry } from "./execution-types";

export const DEFAULT_EXECUTION_POLICY: Readonly<ExecutionPolicy> = Object.freeze({
  rolloutStages: Object.freeze([10, 25, 50, 75, 100]),
  rollbackEnabled: true,
  autoPromote: false,
});

/**
 * Builds a frozen list of ExecutionStage objects from policy rolloutStages.
 */
export function buildExecutionStages(
  stages: readonly number[],
  currentStage: number,
  currentState: ExecutionStage["state"]
): readonly ExecutionStage[] {
  return Object.freeze(
    stages.map((pct, idx) => {
      const sNum = idx + 1;
      let state: ExecutionStage["state"] = "scheduled";
      if (sNum < currentStage) {
        state = "completed";
      } else if (sNum === currentStage) {
        state = currentState;
      } else {
        state = "scheduled";
      }
      return Object.freeze({
        stageNumber: sNum,
        trafficPercentage: pct,
        state,
      });
    })
  );
}

/**
 * Builds a frozen ExecutionHistoryEntry.
 */
export function buildHistoryEntry(
  sequence: number,
  stageNumber: number,
  trafficPercentage: number,
  state: ExecutionStage["state"]
): Readonly<ExecutionHistoryEntry> {
  return Object.freeze({
    sequence,
    stageNumber,
    trafficPercentage,
    state,
  });
}
