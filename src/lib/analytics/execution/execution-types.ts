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
// ─── VRF-ONBOARD-005C — Deployment Executor Types ────────────────────────────

import type { RolloutAction } from "../rollout/rollout-types";

export type ExecutionState =
  | "scheduled"
  | "executing"
  | "completed"
  | "rolled_back"
  | "cancelled";

export interface ExecutionPolicy {
  rolloutStages: readonly number[];
  rollbackEnabled: boolean;
  autoPromote: boolean;
}

export interface ExecutionStage {
  stageNumber: number;
  trafficPercentage: number;
  state: ExecutionState;
}

export interface ExecutionHistoryEntry {
  sequence: number;
  stageNumber: number;
  trafficPercentage: number;
  state: ExecutionState;
}

export interface ExecutionReport {
  experimentId: string;
  action: RolloutAction;
  currentStage: number;
  currentState: ExecutionState;
  stages: readonly ExecutionStage[];
  executionHistory: readonly ExecutionHistoryEntry[];
  rollbackEnabled: boolean;
}

export interface ExecutionResult {
  report: ExecutionReport;
}
