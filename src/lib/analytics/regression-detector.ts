// ─── VRF-ONBOARD-001E.12E — Regression Detector ─────────────────────────

import type { RegressionContext, RegressionResult, RegressionSeverity } from "./experiments";

/**
 * Calculates conversion rate delta (treatment - control).
 * Regression condition: conversionDelta < 0
 */
export function detectConversionRegression(
  control: number,
  treatment: number
): number {
  return Math.round((treatment - control) * 100) / 100;
}

/**
 * Calculates recovery rate delta (treatment - control).
 * Regression condition: recoveryDelta < 0
 */
export function detectRecoveryRegression(
  control: number,
  treatment: number
): number {
  return Math.round((treatment - control) * 100) / 100;
}

/**
 * Calculates completion duration delta in minutes (treatmentMinutes - controlMinutes).
 * Regression condition: completionDelta > 0 (duration increased)
 */
export function detectCompletionRegression(
  controlMinutes: number,
  treatmentMinutes: number
): number {
  return Math.round((treatmentMinutes - controlMinutes) * 100) / 100;
}

/**
 * Maps a risk score (0–100) to RegressionSeverity tier:
 * - 0       → "none"
 * - 1–24    → "low"
 * - 25–49   → "medium"
 * - 50–74   → "high"
 * - 75–100  → "critical"
 */
export function classifyRegressionSeverity(
  riskScore: number
): RegressionSeverity {
  const score = Math.max(0, Math.min(100, Math.round(riskScore)));
  if (score === 0) return "none";
  if (score <= 24) return "low";
  if (score <= 49) return "medium";
  if (score <= 74) return "high";
  return "critical";
}

/**
 * Computes regression risk score (0–100) based on weighted deltas.
 *
 * Weighting:
 * - Conversion regression: max 50 points
 * - Recovery regression: max 30 points
 * - Completion duration regression: max 20 points
 */
export function computeRiskScore(
  context: RegressionContext
): number {
  if (!context) {
    throw new Error("RegressionContext is required.");
  }

  const conversionDelta = detectConversionRegression(
    context.controlConversionRate,
    context.treatmentConversionRate
  );
  const recoveryDelta = detectRecoveryRegression(
    context.controlRecoveryRate,
    context.treatmentRecoveryRate
  );
  const completionDelta = detectCompletionRegression(
    context.controlCompletionMinutes,
    context.treatmentCompletionMinutes
  );

  let conversionPoints = 0;
  if (conversionDelta < 0) {
    const base = Math.max(0.01, context.controlConversionRate);
    const dropRatio = Math.abs(conversionDelta) / base;
    conversionPoints = Math.min(50, dropRatio * 50);
  }

  let recoveryPoints = 0;
  if (recoveryDelta < 0) {
    const base = Math.max(0.01, context.controlRecoveryRate);
    const dropRatio = Math.abs(recoveryDelta) / base;
    recoveryPoints = Math.min(30, dropRatio * 30);
  }

  let completionPoints = 0;
  if (completionDelta > 0) {
    const base = Math.max(0.01, context.controlCompletionMinutes);
    const increaseRatio = completionDelta / base;
    completionPoints = Math.min(20, increaseRatio * 20);
  }

  const rawScore = Math.round(conversionPoints + recoveryPoints + completionPoints);
  return Math.max(0, Math.min(100, rawScore));
}

/**
 * Generates human-readable alert strings based on regression results.
 */
export function generateRegressionAlerts(
  result: Partial<RegressionResult>
): string[] {
  const alerts: string[] = [];

  if (typeof result.conversionDelta === "number" && result.conversionDelta < 0) {
    alerts.push(`Conversion rate dropped by ${Math.abs(result.conversionDelta)}%`);
  }

  if (typeof result.recoveryDelta === "number" && result.recoveryDelta < 0) {
    alerts.push(`Recovery rate dropped by ${Math.abs(result.recoveryDelta)}%`);
  }

  if (typeof result.completionDelta === "number" && result.completionDelta > 0) {
    alerts.push(`Completion duration increased by ${result.completionDelta} minutes`);
  }

  if (result.severity === "critical") {
    alerts.push("Critical regression detected");
  }

  return alerts;
}

/**
 * Master regression detector function evaluating all metrics against control baseline.
 */
export function detectRegression(
  context: RegressionContext
): RegressionResult {
  if (!context) {
    throw new Error("RegressionContext is required.");
  }

  const conversionDelta = detectConversionRegression(
    context.controlConversionRate,
    context.treatmentConversionRate
  );
  const recoveryDelta = detectRecoveryRegression(
    context.controlRecoveryRate,
    context.treatmentRecoveryRate
  );
  const completionDelta = detectCompletionRegression(
    context.controlCompletionMinutes,
    context.treatmentCompletionMinutes
  );

  const riskScore = computeRiskScore(context);
  const severity = classifyRegressionSeverity(riskScore);
  const regressionDetected = conversionDelta < 0 || recoveryDelta < 0 || completionDelta > 0;

  const partialResult: Partial<RegressionResult> = {
    conversionDelta,
    recoveryDelta,
    completionDelta,
    severity,
  };

  const alerts = generateRegressionAlerts(partialResult);

  return {
    regressionDetected,
    severity,
    riskScore,
    conversionDelta,
    recoveryDelta,
    completionDelta,
    alerts,
  };
}
