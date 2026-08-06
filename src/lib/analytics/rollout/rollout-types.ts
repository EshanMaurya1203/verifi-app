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
// ─── VRF-ONBOARD-005B — Rollout Engine Types ─────────────────────────────────

import type { DecisionState } from "../decision/decision-types";

export type RolloutAction =
  | "keep_running"
  | "increase_traffic"
  | "decrease_traffic"
  | "pause_experiment"
  | "archive_experiment";

export interface RolloutPolicy {
  winnerTrafficPercentage: number;
  rollbackTrafficPercentage: number;
  archiveOnRegression: boolean;
}

export interface TrafficAllocation {
  baselineVariantId: string;
  candidateVariantId: string;
  baselinePercentage: number;
  candidatePercentage: number;
}

export interface RolloutPlan {
  experimentId: string;
  action: RolloutAction;
  allocation: TrafficAllocation;
  reasonCode: string;
  decision: DecisionState;
}

export interface RolloutResult {
  plan: RolloutPlan;
}
