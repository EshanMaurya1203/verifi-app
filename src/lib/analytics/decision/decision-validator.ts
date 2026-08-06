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
// ─── VRF-ONBOARD-005A — Decision Validator ──────────────────────────────────

import type { SignificanceReport } from "../statistics/statistics-types";
import type { VariantMetrics } from "../metrics/metrics-types";
import type { DecisionConfig } from "./decision-types";

export interface DecisionValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates a decision analysis request.
 * Rules:
 * 1. significance payload required with valid experimentId.
 * 2. baselineMetrics required with matching experimentId and baselineVariantId.
 * 3. candidateMetrics required with matching experimentId and candidateVariantId.
 * 4. Optional config validation: minimumSampleSize > 0, 0 < minimumConfidence < 1.
 */
export function validateDecisionRequest(
  significance: SignificanceReport,
  baselineMetrics: VariantMetrics,
  candidateMetrics: VariantMetrics,
  config?: Partial<DecisionConfig>
): DecisionValidationResult {
  const errors: string[] = [];

  if (!significance || typeof significance !== "object") {
    return { passed: false, errors: ["SignificanceReport payload is required."] };
  }

  if (!significance.experimentId || typeof significance.experimentId !== "string" || significance.experimentId.trim() === "") {
    errors.push("SignificanceReport requires a valid non-empty experimentId.");
  }

  const expId = significance.experimentId ? significance.experimentId.trim() : "";

  if (!baselineMetrics || typeof baselineMetrics !== "object") {
    errors.push("Baseline VariantMetrics is required.");
  } else {
    if (expId && baselineMetrics.experimentId.trim() !== expId) {
      errors.push(
        `Baseline experimentId '${baselineMetrics.experimentId}' does not match significance experimentId '${expId}'.`
      );
    }
    if (significance.baselineVariantId && baselineMetrics.variantId.trim() !== significance.baselineVariantId.trim()) {
      errors.push(
        `Baseline variantId '${baselineMetrics.variantId}' does not match significance baselineVariantId '${significance.baselineVariantId}'.`
      );
    }
  }

  if (!candidateMetrics || typeof candidateMetrics !== "object") {
    errors.push("Candidate VariantMetrics is required.");
  } else {
    if (expId && candidateMetrics.experimentId.trim() !== expId) {
      errors.push(
        `Candidate experimentId '${candidateMetrics.experimentId}' does not match significance experimentId '${expId}'.`
      );
    }
    if (significance.candidateVariantId && candidateMetrics.variantId.trim() !== significance.candidateVariantId.trim()) {
      errors.push(
        `Candidate variantId '${candidateMetrics.variantId}' does not match significance candidateVariantId '${significance.candidateVariantId}'.`
      );
    }
  }

  if (config) {
    if (config.minimumSampleSize !== undefined) {
      if (typeof config.minimumSampleSize !== "number" || isNaN(config.minimumSampleSize) || config.minimumSampleSize <= 0) {
        errors.push("Config minimumSampleSize must be a number greater than 0.");
      }
    }
    if (config.minimumConfidence !== undefined) {
      if (typeof config.minimumConfidence !== "number" || isNaN(config.minimumConfidence) || config.minimumConfidence <= 0 || config.minimumConfidence >= 1) {
        errors.push("Config minimumConfidence must be a number strictly between 0 and 1.");
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
