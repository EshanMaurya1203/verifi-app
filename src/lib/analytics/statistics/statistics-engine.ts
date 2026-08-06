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
// ─── VRF-ONBOARD-004E — Statistics Engine Module ──────────────────────────────

import { StatisticsValidationError } from "./statistics-errors";
import type { VariantMetrics } from "../metrics/metrics-types";
import type { SignificanceReport, StatisticsResult } from "./statistics-types";
import {
  computeConversionRate,
  computeLift,
  computeZScore,
  computePValue,
} from "./statistics-utils";
import { validateStatisticsRequest } from "./statistics-validator";

/**
 * Deterministically analyzes statistical significance between baseline and candidate variants.
 *
 * Rules & Invariants:
 * 1. Validates input request; throws StatisticsValidationError on invalid input.
 * 2. Computes baselineRate, candidateRate, lift, Z-score, p-value, and statistical significance.
 * 3. Handles 0 exposures safely (statisticallySignificant = false, pValue = 1.0, zScore = 0).
 * 4. Never returns NaN or Infinity for Z-score or p-value.
 * 5. Returns a deeply frozen StatisticsResult payload.
 * 6. Never mutates input arguments.
 * 7. Contains no internal time creation (new Date() / Date.now() forbidden).
 * 8. NEVER performs winner selection or automated rollout decisions.
 */
export function analyzeSignificance(
  experimentId: string,
  baseline: VariantMetrics,
  candidate: VariantMetrics,
  confidenceLevel: number = 0.95
): StatisticsResult {
  const validation = validateStatisticsRequest(experimentId, baseline, candidate, confidenceLevel);
  if (!validation.passed) {
    throw new StatisticsValidationError(
      `Invalid statistics request: ${validation.errors.join("; ")}`
    );
  }

  const cleanExpId = experimentId.trim();
  const baselineRate = computeConversionRate(baseline.conversions, baseline.exposures);
  const candidateRate = computeConversionRate(candidate.conversions, candidate.exposures);
  const lift = computeLift(candidateRate, baselineRate);

  let zScore = 0;
  let pValue = 1.0;
  let statisticallySignificant = false;

  // Zero sample safety check (INV_140)
  if (baseline.exposures > 0 && candidate.exposures > 0) {
    zScore = computeZScore(
      baseline.conversions,
      baseline.exposures,
      candidate.conversions,
      candidate.exposures
    );
    pValue = computePValue(zScore);

    const alpha = 1 - confidenceLevel;
    statisticallySignificant = pValue < alpha;
  }

  const report: SignificanceReport = Object.freeze({
    experimentId: cleanExpId,
    baselineVariantId: baseline.variantId.trim(),
    candidateVariantId: candidate.variantId.trim(),
    baselineRate,
    candidateRate,
    lift,
    zScore,
    pValue,
    confidenceLevel,
    statisticallySignificant,
  });

  return Object.freeze({
    report,
  });
}
