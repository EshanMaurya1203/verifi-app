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
// ─── VRF-ONBOARD-004E — Statistics Validator ────────────────────────────────

import type { VariantMetrics } from "../metrics/metrics-types";

export interface StatisticsValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates a statistical analysis request.
 * Rules:
 * 1. experimentId required non-empty string.
 * 2. baseline required VariantMetrics object.
 * 3. candidate required VariantMetrics object.
 * 4. baseline and candidate experimentId must match request experimentId.
 * 5. exposures >= conversions >= 0 for baseline and candidate.
 * 6. confidenceLevel must be between 0 and 1 exclusive (e.g. 0.95).
 */
export function validateStatisticsRequest(
  experimentId: string,
  baseline: VariantMetrics,
  candidate: VariantMetrics,
  confidenceLevel: number = 0.95
): StatisticsValidationResult {
  const errors: string[] = [];

  if (!experimentId || typeof experimentId !== "string" || experimentId.trim() === "") {
    errors.push("Statistics request requires a valid non-empty experimentId.");
  }

  if (!baseline || typeof baseline !== "object") {
    errors.push("Baseline VariantMetrics is required.");
  } else {
    if (experimentId && baseline.experimentId.trim() !== experimentId.trim()) {
      errors.push(
        `Baseline experimentId '${baseline.experimentId}' does not match requested experimentId '${experimentId}'.`
      );
    }
    if (baseline.exposures < 0) {
      errors.push("Baseline exposures cannot be negative.");
    }
    if (baseline.conversions < 0) {
      errors.push("Baseline conversions cannot be negative.");
    }
    if (baseline.conversions > baseline.exposures) {
      errors.push(
        `Baseline conversions (${baseline.conversions}) cannot exceed exposures (${baseline.exposures}).`
      );
    }
  }

  if (!candidate || typeof candidate !== "object") {
    errors.push("Candidate VariantMetrics is required.");
  } else {
    if (experimentId && candidate.experimentId.trim() !== experimentId.trim()) {
      errors.push(
        `Candidate experimentId '${candidate.experimentId}' does not match requested experimentId '${experimentId}'.`
      );
    }
    if (candidate.exposures < 0) {
      errors.push("Candidate exposures cannot be negative.");
    }
    if (candidate.conversions < 0) {
      errors.push("Candidate conversions cannot be negative.");
    }
    if (candidate.conversions > candidate.exposures) {
      errors.push(
        `Candidate conversions (${candidate.conversions}) cannot exceed exposures (${candidate.exposures}).`
      );
    }
  }

  if (typeof confidenceLevel !== "number" || isNaN(confidenceLevel) || confidenceLevel <= 0 || confidenceLevel >= 1) {
    errors.push("Confidence level must be a number strictly between 0 and 1 (e.g., 0.95).");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
