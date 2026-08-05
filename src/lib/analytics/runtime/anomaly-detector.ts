// ─── VRF-ONBOARD-002E — Anomaly Detector Engine ─────────────────────────

import type { ExperimentMetrics } from "./observability-types";

export interface Anomaly {
  experimentId: string;

  type: "missing_views" | "high_failure_rate" | "assignment_mismatch";

  severity: "low" | "medium" | "high";
}

/**
 * Detects operational anomalies for an experiment based on its aggregated metrics.
 *
 * Rules:
 * - missing_views: variantSeen < assignments (severity: medium)
 * - high_failure_rate: failures >= 3 (severity: high)
 * - assignment_mismatch: variantSeen > assignments (severity: medium)
 */
export function detectAnomalies(
  metrics: ExperimentMetrics
): Anomaly[] {
  if (!metrics || !metrics.experimentId) {
    return [];
  }

  const anomalies: Anomaly[] = [];

  // 1. Missing views anomaly
  if (metrics.variantSeen < metrics.assignments) {
    anomalies.push({
      experimentId: metrics.experimentId,
      type: "missing_views",
      severity: "medium",
    });
  }

  // 2. High failure rate anomaly
  if (metrics.failures >= 3) {
    anomalies.push({
      experimentId: metrics.experimentId,
      type: "high_failure_rate",
      severity: "high",
    });
  }

  // 3. Assignment mismatch anomaly
  if (metrics.variantSeen > metrics.assignments) {
    anomalies.push({
      experimentId: metrics.experimentId,
      type: "assignment_mismatch",
      severity: "medium",
    });
  }

  return anomalies;
}
