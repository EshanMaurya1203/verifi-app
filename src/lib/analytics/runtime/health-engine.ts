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
// ─── VRF-ONBOARD-002E — Experiment Health Engine ────────────────────────

import type { ExperimentHealth, ExperimentMetrics } from "./observability-types";

/**
 * Computes health score and status for an experiment based on its metrics.
 *
 * Rules:
 * - healthScore = 100 - (failures × 15) - (missing views × 10) - (assignment mismatch × 10)
 * - missing views = max(0, assignments - variantSeen)
 * - assignment mismatch = max(0, variantSeen - assignments)
 * - Score range: bounded strictly between 0 and 100
 * - Status:
 *     80–100 → "healthy"
 *     50–79 → "warning"
 *     0–49 → "critical"
 */
export function computeHealth(
  metrics: ExperimentMetrics
): ExperimentHealth {
  if (!metrics || !metrics.experimentId) {
    throw new Error("ExperimentMetrics is required.");
  }

  const missingViews = metrics.variantSeen < metrics.assignments ? metrics.assignments - metrics.variantSeen : 0;
  const assignmentMismatch = metrics.variantSeen > metrics.assignments ? metrics.variantSeen - metrics.assignments : 0;

  const rawScore = 100 - metrics.failures * 15 - missingViews * 10 - assignmentMismatch * 10;
  const score = Math.max(0, Math.min(100, rawScore));

  let status: "healthy" | "warning" | "critical";
  if (score >= 80) {
    status = "healthy";
  } else if (score >= 50) {
    status = "warning";
  } else {
    status = "critical";
  }

  return {
    experimentId: metrics.experimentId,
    status,
    score,
  };
}
