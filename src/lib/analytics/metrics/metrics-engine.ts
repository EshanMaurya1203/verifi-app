// ─── VRF-ONBOARD-004D — Metrics Aggregation Engine ───────────────────────────

import { MetricsValidationError } from "./metrics-errors";
import type { ExposureEvent } from "../exposure/exposure-types";
import type { ConversionEvent } from "../conversion/conversion-types";
import type { VariantMetrics, ExperimentMetrics, MetricsSnapshot, MetricsResult } from "./metrics-types";
import { buildMetricsSnapshotId, computeSafeConversionRate } from "./metrics-utils";
import { validateMetricsRequest } from "./metrics-validator";

/**
 * Deterministically aggregates exposures and conversions into an immutable MetricsSnapshot.
 *
 * Rules & Invariants:
 * 1. Strictly validates input parameters; throws MetricsValidationError on invalid input.
 * 2. Groups events by variant ID, sorted canonically (lexicographically by variantId).
 * 3. Computes exposures, uniqueExposures, conversions, uniqueConversions, and conversionRate per variant.
 * 4. Computes totalExposures, totalConversions, and overallConversionRate across the experiment.
 * 5. Uses zero-division safe rate calculation (never returns NaN, Infinity, or -0).
 * 6. Returns a deeply frozen MetricsResult payload.
 * 7. Never mutates input arguments.
 * 8. Contains no internal time creation (new Date() / Date.now() forbidden).
 */
export function aggregateMetrics(
  experimentId: string,
  exposures: readonly ExposureEvent[],
  conversions: readonly ConversionEvent[],
  generatedAt: Date
): MetricsResult {
  const validation = validateMetricsRequest(experimentId, exposures, conversions, generatedAt);
  if (!validation.passed) {
    throw new MetricsValidationError(
      `Invalid metrics aggregation request: ${validation.errors.join("; ")}`
    );
  }

  const cleanExpId = experimentId.trim();

  // Collect all unique variant IDs present across exposures and conversions
  const variantSet = new Set<string>();
  for (const exp of exposures) {
    if (exp.variantId) {
      variantSet.add(exp.variantId.trim());
    }
  }
  for (const conv of conversions) {
    if (conv.variantId) {
      variantSet.add(conv.variantId.trim());
    }
  }

  // Canonical ordering: sort variant IDs lexicographically (INV_135)
  const sortedVariantIds = Array.from(variantSet).sort((a, b) => a.localeCompare(b));

  const variantMetricsList: VariantMetrics[] = sortedVariantIds.map((vId) => {
    const varExposures = exposures.filter((e) => e.variantId.trim() === vId);
    const varConversions = conversions.filter((c) => c.variantId.trim() === vId);

    const expCount = varExposures.length;
    const uniqueExpCount = new Set(varExposures.map((e) => e.sessionId.trim())).size;

    const convCount = varConversions.length;
    const uniqueConvCount = new Set(varConversions.map((c) => c.sessionId.trim())).size;

    const rate = computeSafeConversionRate(convCount, expCount);

    return Object.freeze({
      experimentId: cleanExpId,
      variantId: vId,
      exposures: expCount,
      uniqueExposures: uniqueExpCount,
      conversions: convCount,
      uniqueConversions: uniqueConvCount,
      conversionRate: rate,
    });
  });

  const totalExposures = exposures.length;
  const totalConversions = conversions.length;
  const overallConversionRate = computeSafeConversionRate(totalConversions, totalExposures);

  const experimentMetrics: ExperimentMetrics = Object.freeze({
    experimentId: cleanExpId,
    variants: Object.freeze(variantMetricsList),
    totalExposures,
    totalConversions,
    overallConversionRate,
  });

  const snapshot: MetricsSnapshot = Object.freeze({
    snapshotId: buildMetricsSnapshotId(cleanExpId, generatedAt),
    experimentId: cleanExpId,
    generatedAt,
    metrics: experimentMetrics,
  });

  return Object.freeze({
    snapshot,
  });
}
