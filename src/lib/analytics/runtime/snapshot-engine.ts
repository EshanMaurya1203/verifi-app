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
// ─── VRF-ONBOARD-002E / 002X — Snapshot Aggregation Engine ─────────────

import type { AuditLog } from "./audit-log";
import { getAuditTrail } from "./audit-log";
import type { EventStorage } from "./event-storage";
import { computeHealth } from "./health-engine";
import { aggregateMetrics } from "./metrics-engine";
import type {
  ExperimentHealth,
  ExperimentMetrics,
  ObservabilitySnapshot,
} from "./observability-types";

/**
 * Builds a point-in-time ObservabilitySnapshot for a set of experiment IDs.
 *
 * VRF-ONBOARD-002X Optimization: Uses single-pass aggregateMetrics O(events)
 * complexity instead of nested O(events × experiments) scans.
 */
export function buildSnapshot(
  experimentIds: string[],
  storage: EventStorage,
  audit: AuditLog
): ObservabilitySnapshot {
  const ids = Array.isArray(experimentIds) ? experimentIds : [];

  // Single pass aggregation O(events)
  const metricsMap = aggregateMetrics(ids, storage);

  const metrics: ExperimentMetrics[] = [];
  const health: ExperimentHealth[] = [];

  for (const experimentId of ids) {
    const expMetrics = metricsMap.get(experimentId) || {
      experimentId,
      assignments: 0,
      variantExposed: 0,
      variantRendered: 0,
      variantSeen: 0,
      conversions: 0,
      failures: 0,
    };

    const expHealth = computeHealth(expMetrics);

    metrics.push(expMetrics);
    health.push(expHealth);
  }

  const auditEntries = audit ? getAuditTrail(audit) : [];

  return {
    generatedAt: new Date(),
    metrics,
    health,
    auditEntries,
  };
}
