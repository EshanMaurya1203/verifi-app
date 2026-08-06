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
// ─── VRF-ONBOARD-005A — Decision Engine Utils ────────────────────────────────

import type { DecisionConfig, DecisionReason } from "./decision-types";

export const DEFAULT_DECISION_CONFIG: Readonly<DecisionConfig> = Object.freeze({
  minimumSampleSize: 1000,
  minimumConfidence: 0.95,
});

export const DECISION_REASON_CODES = {
  INSUFFICIENT_SAMPLE: "INSUFFICIENT_SAMPLE",
  INCONCLUSIVE_RESULT: "INCONCLUSIVE_RESULT",
  CANDIDATE_OUTPERFORMS_BASELINE: "CANDIDATE_OUTPERFORMS_BASELINE",
  CANDIDATE_UNDERPERFORMS_BASELINE: "CANDIDATE_UNDERPERFORMS_BASELINE",
  CONTINUE_EXPERIMENT: "CONTINUE_EXPERIMENT",
} as const;

/**
 * Builds a frozen DecisionReason structure for a given code.
 */
export function buildDecisionReason(code: keyof typeof DECISION_REASON_CODES): Readonly<DecisionReason> {
  let message = "Experiment requires further observation.";
  switch (code) {
    case "INSUFFICIENT_SAMPLE":
      message = "Combined sample size (totalExposures) is less than minimum required sample size.";
      break;
    case "INCONCLUSIVE_RESULT":
      message = "Result is not statistically significant at the required confidence level.";
      break;
    case "CANDIDATE_OUTPERFORMS_BASELINE":
      message = "Candidate conversion rate significantly outperforms baseline.";
      break;
    case "CANDIDATE_UNDERPERFORMS_BASELINE":
      message = "Candidate conversion rate significantly underperforms baseline.";
      break;
    case "CONTINUE_EXPERIMENT":
      message = "Experiment requires further observation.";
      break;
  }
  return Object.freeze({
    code: DECISION_REASON_CODES[code],
    message,
  });
}
