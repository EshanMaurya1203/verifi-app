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
// ─── VRF-ONBOARD-005A — Decision Engine Types ────────────────────────────────

export type DecisionState =
  | "continue"
  | "winner_detected"
  | "regression_detected"
  | "inconclusive"
  | "insufficient_sample";

export interface DecisionConfig {
  minimumSampleSize: number;
  minimumConfidence: number;
}

export interface DecisionReason {
  code: string;
  message: string;
}

export interface DecisionReport {
  experimentId: string;
  baselineVariantId: string;
  candidateVariantId: string;
  decision: DecisionState;
  confidence: number;
  statisticallySignificant: boolean;
  sampleSizeReached: boolean;
  reason: DecisionReason;
}

export interface DecisionResult {
  report: DecisionReport;
}
