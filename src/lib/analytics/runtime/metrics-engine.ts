// ─── VRF-ONBOARD-002E / 002X — Metrics Aggregator Engine ─────────────────

import type { EventStorage } from "./event-storage";
import { getExperimentEvents } from "./event-storage";
import type { ExperimentMetrics } from "./observability-types";

/**
 * Computes runtime metrics for a specific experiment from EventStorage.
 */
export function computeMetrics(
  experimentId: string,
  storage: EventStorage
): ExperimentMetrics {
  if (!experimentId) {
    throw new Error("experimentId is required.");
  }

  const events = getExperimentEvents(experimentId, storage);

  let assignments = 0;
  let variantExposed = 0;
  let variantRendered = 0;
  let variantSeen = 0;
  let conversions = 0;
  let failures = 0;

  for (const event of events) {
    switch (event.eventType) {
      case "experiment_assigned":
        assignments += 1;
        break;
      case "variant_exposed":
        variantExposed += 1;
        variantSeen += 1;
        break;
      case "variant_rendered":
        variantRendered += 1;
        variantSeen += 1;
        break;
      case "variant_seen":
        variantExposed += 1;
        variantSeen += 1;
        break;
      case "variant_completed":
        conversions += 1;
        break;
      case "stripe_sync_failed":
      case "razorpay_sync_failed":
        failures += 1;
        break;
    }
  }

  return {
    experimentId,
    assignments,
    variantExposed,
    variantRendered,
    variantSeen,
    conversions,
    failures,
  };
}

/**
 * Single-pass O(events) metric aggregation across all experiment IDs.
 * Bypasses O(events × experiments) nested scans.
 */
export function aggregateMetrics(
  experimentIds: string[],
  storage: EventStorage
): Map<string, ExperimentMetrics> {
  const map = new Map<string, ExperimentMetrics>();
  const validIds = new Set(experimentIds);

  for (const id of experimentIds) {
    map.set(id, {
      experimentId: id,
      assignments: 0,
      variantExposed: 0,
      variantRendered: 0,
      variantSeen: 0,
      conversions: 0,
      failures: 0,
    });
  }

  if (!storage || !storage.records) {
    return map;
  }

  // Single pass through all storage records O(N)
  for (const event of storage.records) {
    if (!event.experimentId || !validIds.has(event.experimentId)) {
      continue;
    }

    const metrics = map.get(event.experimentId)!;
    switch (event.eventType) {
      case "experiment_assigned":
        metrics.assignments += 1;
        break;
      case "variant_exposed":
        metrics.variantExposed += 1;
        metrics.variantSeen += 1;
        break;
      case "variant_rendered":
        metrics.variantRendered += 1;
        metrics.variantSeen += 1;
        break;
      case "variant_seen":
        metrics.variantExposed += 1;
        metrics.variantSeen += 1;
        break;
      case "variant_completed":
        metrics.conversions += 1;
        break;
      case "stripe_sync_failed":
      case "razorpay_sync_failed":
        metrics.failures += 1;
        break;
    }
  }

  return map;
}
