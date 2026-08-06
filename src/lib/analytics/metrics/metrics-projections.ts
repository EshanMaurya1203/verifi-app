// ─── VRF-ONBOARD-004D — Metrics Projections Module ───────────────────────────

import type { VariantMetrics, ExperimentMetrics, MetricsSnapshot, MetricsResult } from "./metrics-types";

/**
 * Projects a deeply frozen VariantMetrics structure.
 */
export function projectVariantMetrics(vm: VariantMetrics): Readonly<VariantMetrics> {
  return Object.freeze({
    experimentId: vm.experimentId,
    variantId: vm.variantId,
    exposures: vm.exposures,
    uniqueExposures: vm.uniqueExposures,
    conversions: vm.conversions,
    uniqueConversions: vm.uniqueConversions,
    conversionRate: vm.conversionRate,
  });
}

/**
 * Projects a deeply frozen ExperimentMetrics structure.
 */
export function projectExperimentMetrics(em: ExperimentMetrics): Readonly<ExperimentMetrics> {
  return Object.freeze({
    experimentId: em.experimentId,
    variants: Object.freeze(em.variants.map((v) => projectVariantMetrics(v))),
    totalExposures: em.totalExposures,
    totalConversions: em.totalConversions,
    overallConversionRate: em.overallConversionRate,
  });
}

/**
 * Projects a deeply frozen MetricsSnapshot structure.
 */
export function projectMetricsSnapshot(snapshot: MetricsSnapshot): Readonly<MetricsSnapshot> {
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    experimentId: snapshot.experimentId,
    generatedAt: snapshot.generatedAt,
    metrics: projectExperimentMetrics(snapshot.metrics),
  });
}

/**
 * Projects a deeply frozen MetricsResult structure.
 */
export function projectMetricsResult(res: MetricsResult): Readonly<MetricsResult> {
  return Object.freeze({
    snapshot: projectMetricsSnapshot(res.snapshot),
  });
}
