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
// ─── VRF-ONBOARD-005A — Decision Engine Module ────────────────────────────────

import { DecisionValidationError } from "./decision-errors";
import type { SignificanceReport } from "../statistics/statistics-types";
import type { VariantMetrics } from "../metrics/metrics-types";
import type { DecisionConfig, DecisionState, DecisionReport, DecisionResult } from "./decision-types";
import { DEFAULT_DECISION_CONFIG, buildDecisionReason } from "./decision-utils";
import { validateDecisionRequest } from "./decision-validator";

/**
 * Deterministically generates an advisory DecisionReport based on statistical significance and metrics.
 *
 * ADVISORY ONLY CONSTRAINTS:
 * 1. Produces recommendations only.
 * 2. NEVER executes decisions, deploys winners, or mutates experiments.
 * 3. Contains zero database writes, APIs, network calls, or side effects.
 *
 * Rules:
 * - RULE 1: totalExposures < minimumSampleSize -> "insufficient_sample"
 * - RULE 2: statisticallySignificant === false -> "inconclusive"
 * - RULE 3: candidateRate > baselineRate AND statisticallySignificant AND sampleSizeReached -> "winner_detected"
 * - RULE 4: candidateRate < baselineRate AND statisticallySignificant AND sampleSizeReached -> "regression_detected"
 * - RULE 5: otherwise -> "continue"
 */
export function makeDecision(
  significance: SignificanceReport,
  baselineMetrics: VariantMetrics,
  candidateMetrics: VariantMetrics,
  config?: Partial<DecisionConfig>
): DecisionResult {
  const validation = validateDecisionRequest(significance, baselineMetrics, candidateMetrics, config);
  if (!validation.passed) {
    throw new DecisionValidationError(
      `Invalid decision request: ${validation.errors.join("; ")}`
    );
  }

  const mergedConfig: DecisionConfig = {
    minimumSampleSize: config?.minimumSampleSize ?? DEFAULT_DECISION_CONFIG.minimumSampleSize,
    minimumConfidence: config?.minimumConfidence ?? DEFAULT_DECISION_CONFIG.minimumConfidence,
  };

  const totalExposures = baselineMetrics.exposures + candidateMetrics.exposures;
  const sampleSizeReached = totalExposures >= mergedConfig.minimumSampleSize;
  const isSig = significance.statisticallySignificant;

  let decision: DecisionState = "continue";
  let reason = buildDecisionReason("CONTINUE_EXPERIMENT");

  if (!sampleSizeReached) {
    decision = "insufficient_sample";
    reason = buildDecisionReason("INSUFFICIENT_SAMPLE");
  } else if (!isSig) {
    decision = "inconclusive";
    reason = buildDecisionReason("INCONCLUSIVE_RESULT");
  } else if (candidateMetrics.conversionRate > baselineMetrics.conversionRate && isSig && sampleSizeReached) {
    decision = "winner_detected";
    reason = buildDecisionReason("CANDIDATE_OUTPERFORMS_BASELINE");
  } else if (candidateMetrics.conversionRate < baselineMetrics.conversionRate && isSig && sampleSizeReached) {
    decision = "regression_detected";
    reason = buildDecisionReason("CANDIDATE_UNDERPERFORMS_BASELINE");
  } else {
    decision = "continue";
    reason = buildDecisionReason("CONTINUE_EXPERIMENT");
  }

  const report: DecisionReport = Object.freeze({
    experimentId: significance.experimentId.trim(),
    baselineVariantId: baselineMetrics.variantId.trim(),
    candidateVariantId: candidateMetrics.variantId.trim(),
    decision,
    confidence: significance.confidenceLevel,
    statisticallySignificant: isSig,
    sampleSizeReached,
    reason,
  });

  return Object.freeze({
    report,
  });
}
