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
// ─── VRF-ONBOARD-005B — Rollout Engine Utils ─────────────────────────────────

import type { RolloutPolicy, TrafficAllocation } from "./rollout-types";

export const DEFAULT_ROLLOUT_POLICY: Readonly<RolloutPolicy> = Object.freeze({
  winnerTrafficPercentage: 75,
  rollbackTrafficPercentage: 10,
  archiveOnRegression: false,
});

export const ROLLOUT_REASON_CODES = {
  KEEP_RUNNING_INSUFFICIENT_SAMPLE: "KEEP_RUNNING_INSUFFICIENT_SAMPLE",
  KEEP_RUNNING_INCONCLUSIVE: "KEEP_RUNNING_INCONCLUSIVE",
  KEEP_RUNNING_CONTINUE: "KEEP_RUNNING_CONTINUE",
  INCREASE_TRAFFIC_WINNER_DETECTED: "INCREASE_TRAFFIC_WINNER_DETECTED",
  DECREASE_TRAFFIC_REGRESSION_DETECTED: "DECREASE_TRAFFIC_REGRESSION_DETECTED",
  ARCHIVE_EXPERIMENT_REGRESSION_DETECTED: "ARCHIVE_EXPERIMENT_REGRESSION_DETECTED",
} as const;

/**
 * Builds a frozen TrafficAllocation object.
 * Guarantees baselinePercentage + candidatePercentage === 100.
 */
export function buildTrafficAllocation(
  baselineVariantId: string,
  candidateVariantId: string,
  candidatePercentage: number
): Readonly<TrafficAllocation> {
  const candPct = Math.max(0, Math.min(100, Math.round(candidatePercentage)));
  const basePct = 100 - candPct;
  return Object.freeze({
    baselineVariantId: baselineVariantId.trim(),
    candidateVariantId: candidateVariantId.trim(),
    baselinePercentage: basePct,
    candidatePercentage: candPct,
  });
}
