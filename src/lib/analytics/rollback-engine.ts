// ─── VRF-ONBOARD-001E.12F — Rollback Intelligence Engine ─────────────────

import type {
  ConfidenceResult,
  RegressionResult,
  RollbackContext,
  RollbackRecommendation,
  RollbackResult,
} from "./experiments";

/**
 * Computes rollback score (0–100) based on weighted regression severity and confidence level.
 *
 * Weighting:
 * - Regression severity: max 70 points
 * - Confidence level: max 30 points
 *
 * Higher confidence amplifies rollback urgency because the regression signal is more trustworthy.
 */
export function computeRollbackScore(
  context: RollbackContext
): number {
  if (!context || !context.regression || !context.confidence) {
    throw new Error("RollbackContext with regression and confidence is required.");
  }

  const { regression, confidence } = context;

  // Regression severity points (max 70)
  const severityWeights: Record<string, number> = {
    none: 0,
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1.0,
  };
  const severityMultiplier = severityWeights[regression.severity] ?? 0;
  const regressionPoints = severityMultiplier * 70;

  // Confidence amplification points (max 30)
  // Higher confidence = more trustworthy signal = higher rollback urgency
  const confidenceMultiplier = confidence.score / 100;
  const confidencePoints = confidenceMultiplier * 30;

  const rawScore = Math.round(regressionPoints + confidencePoints);
  return Math.max(0, Math.min(100, rawScore));
}

/**
 * Maps a rollback score (0–100) to a RollbackRecommendation tier:
 * - 0–19   → "none"
 * - 20–39  → "monitor"
 * - 40–59  → "consider"
 * - 60–79  → "recommended"
 * - 80–100 → "immediate"
 */
export function recommendRollback(
  score: number
): RollbackRecommendation {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 19) return "none";
  if (s <= 39) return "monitor";
  if (s <= 59) return "consider";
  if (s <= 79) return "recommended";
  return "immediate";
}

/**
 * Evaluates whether it is safe to continue the experiment based on rollback recommendation.
 *
 * Safe to continue:
 * - "none"      → true
 * - "monitor"   → true
 * - "consider"  → true
 * - "recommended" → false
 * - "immediate"   → false
 */
export function evaluateSafety(
  rollback: RollbackRecommendation
): boolean {
  return rollback === "none" || rollback === "monitor" || rollback === "consider";
}

/**
 * Generates human-readable rollback reason strings based on regression and confidence context.
 */
export function generateRollbackReasons(
  context: RollbackContext
): string[] {
  if (!context || !context.regression || !context.confidence) {
    return [];
  }

  const reasons: string[] = [];
  const { regression, confidence } = context;

  // Regression-based reasons
  if (regression.severity === "critical") {
    reasons.push("Critical regression detected");
  } else if (regression.severity === "high") {
    reasons.push("High-severity regression detected");
  }

  if (regression.conversionDelta < 0) {
    reasons.push(`Conversion rate dropped by ${Math.abs(regression.conversionDelta)}%`);
  }

  if (regression.recoveryDelta < 0) {
    reasons.push(`Recovery rate dropped by ${Math.abs(regression.recoveryDelta)}%`);
  }

  if (regression.completionDelta > 0) {
    reasons.push(`Completion duration increased by ${regression.completionDelta} minutes`);
  }

  // Confidence-based reasons
  if (confidence.level === "high") {
    reasons.push("High-confidence experiment");
  }

  if (confidence.winnerEligible) {
    reasons.push("Winner eligibility satisfied");
  }

  return reasons;
}

/**
 * Master rollback evaluation function.
 * Combines regression severity and confidence to produce a rollback recommendation.
 */
export function evaluateRollback(
  context: RollbackContext
): RollbackResult {
  if (!context || !context.regression || !context.confidence) {
    throw new Error("RollbackContext with regression and confidence is required.");
  }

  const rollbackScore = computeRollbackScore(context);
  const recommendation = recommendRollback(rollbackScore);
  const safeToContinue = evaluateSafety(recommendation);
  const reasons = generateRollbackReasons(context);

  return {
    recommendation,
    rollbackScore,
    safeToContinue,
    reasons,
  };
}
