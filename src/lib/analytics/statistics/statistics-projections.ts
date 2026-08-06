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
// ─── VRF-ONBOARD-004E — Statistics Projections Module ────────────────────────

import type { VariantStatistics, SignificanceReport, StatisticsResult } from "./statistics-types";

/**
 * Projects a deeply frozen VariantStatistics structure.
 */
export function projectVariantStatistics(vs: VariantStatistics): Readonly<VariantStatistics> {
  return Object.freeze({
    experimentId: vs.experimentId,
    variantId: vs.variantId,
    exposures: vs.exposures,
    conversions: vs.conversions,
    conversionRate: vs.conversionRate,
    standardError: vs.standardError,
  });
}

/**
 * Projects a deeply frozen SignificanceReport structure.
 */
export function projectSignificanceReport(report: SignificanceReport): Readonly<SignificanceReport> {
  return Object.freeze({
    experimentId: report.experimentId,
    baselineVariantId: report.baselineVariantId,
    candidateVariantId: report.candidateVariantId,
    baselineRate: report.baselineRate,
    candidateRate: report.candidateRate,
    lift: report.lift,
    zScore: report.zScore,
    pValue: report.pValue,
    confidenceLevel: report.confidenceLevel,
    statisticallySignificant: report.statisticallySignificant,
  });
}

/**
 * Projects a deeply frozen StatisticsResult structure.
 */
export function projectStatisticsResult(res: StatisticsResult): Readonly<StatisticsResult> {
  return Object.freeze({
    report: projectSignificanceReport(res.report),
  });
}
