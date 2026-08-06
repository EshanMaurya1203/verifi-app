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
// ─── VRF-ONBOARD-005A — Decision Projections Module ─────────────────────────

import type { DecisionReason, DecisionReport, DecisionResult } from "./decision-types";

/**
 * Projects a deeply frozen DecisionReason structure.
 */
export function projectDecisionReason(reason: DecisionReason): Readonly<DecisionReason> {
  return Object.freeze({
    code: reason.code,
    message: reason.message,
  });
}

/**
 * Projects a deeply frozen DecisionReport structure.
 */
export function projectDecisionReport(report: DecisionReport): Readonly<DecisionReport> {
  return Object.freeze({
    experimentId: report.experimentId,
    baselineVariantId: report.baselineVariantId,
    candidateVariantId: report.candidateVariantId,
    decision: report.decision,
    confidence: report.confidence,
    statisticallySignificant: report.statisticallySignificant,
    sampleSizeReached: report.sampleSizeReached,
    reason: projectDecisionReason(report.reason),
  });
}

/**
 * Projects a deeply frozen DecisionResult structure.
 */
export function projectDecisionResult(res: DecisionResult): Readonly<DecisionResult> {
  return Object.freeze({
    report: projectDecisionReport(res.report),
  });
}
