// ─── VRF-ONBOARD-001E.12G — Experiment Dashboard Aggregation Layer ──────

import type {
  ConfidenceResult,
  DashboardAlert,
  DashboardExperimentCard,
  DashboardState,
  DashboardSummary,
  Experiment,
  RegressionResult,
  RollbackResult,
} from "./experiments";

/**
 * Builds a clean DashboardExperimentCard for UI visualization.
 */
export function buildExperimentCard(
  experiment: Experiment,
  confidence: ConfidenceResult,
  regression: RegressionResult,
  rollback: RollbackResult
): DashboardExperimentCard {
  if (!experiment || !confidence || !regression || !rollback) {
    throw new Error("Experiment, ConfidenceResult, RegressionResult, and RollbackResult are required.");
  }

  return {
    experimentId: experiment.id,
    experimentName: experiment.name,
    status: experiment.status,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    regressionSeverity: regression.severity,
    rollbackRecommendation: rollback.recommendation,
    safeToContinue: rollback.safeToContinue,
  };
}

/**
 * Builds actionable dashboard alerts from experiment cards.
 *
 * Rules:
 * - Low confidence (level === "low" & running) → info alert
 * - Medium/High/Critical regression → warning alert
 * - Recommended rollback → critical alert
 * - Immediate rollback → critical alert
 */
export function buildDashboardAlerts(
  cards: DashboardExperimentCard[]
): DashboardAlert[] {
  if (!cards || cards.length === 0) {
    return [];
  }

  const alerts: DashboardAlert[] = [];

  for (const card of cards) {
    // 1. Low Confidence Alert
    if (card.confidenceLevel === "low" && card.status === "running") {
      alerts.push({
        type: "confidence",
        severity: "info",
        message: `Experiment '${card.experimentName}' has low statistical confidence (${card.confidenceScore}%).`,
      });
    }

    // 2. Regression Alert (Medium / High)
    if (
      card.regressionSeverity === "medium" ||
      card.regressionSeverity === "high"
    ) {
      alerts.push({
        type: "regression",
        severity: "warning",
        message: `Regression (${card.regressionSeverity}) detected in experiment '${card.experimentName}'.`,
      });
    }

    // 3. Recommended Rollback Alert
    if (card.rollbackRecommendation === "recommended") {
      alerts.push({
        type: "rollback",
        severity: "critical",
        message: `Rollback recommended for experiment '${card.experimentName}'.`,
      });
    }

    // 4. Immediate Rollback Alert
    if (card.rollbackRecommendation === "immediate") {
      alerts.push({
        type: "rollback",
        severity: "critical",
        message: `Immediate rollback required for experiment '${card.experimentName}'.`,
      });
    }
  }

  return alerts;
}

/**
 * Computes aggregate summary metrics across all experiment cards.
 *
 * Rules:
 * - totalExperiments: total count of cards
 * - runningExperiments: cards with status === "running"
 * - healthyExperiments: cards with safeToContinue === true
 * - riskyExperiments: cards with regressionSeverity === "high" | "critical"
 * - blockedExperiments: cards with rollbackRecommendation === "recommended" | "immediate"
 */
export function buildDashboardSummary(
  cards: DashboardExperimentCard[]
): DashboardSummary {
  if (!cards || cards.length === 0) {
    return {
      totalExperiments: 0,
      runningExperiments: 0,
      healthyExperiments: 0,
      riskyExperiments: 0,
      blockedExperiments: 0,
    };
  }

  const totalExperiments = cards.length;
  const runningExperiments = cards.filter((c) => c.status === "running").length;
  const healthyExperiments = cards.filter((c) => c.safeToContinue === true).length;
  const riskyExperiments = cards.filter(
    (c) => c.regressionSeverity === "high" || c.regressionSeverity === "critical"
  ).length;
  const blockedExperiments = cards.filter(
    (c) =>
      c.rollbackRecommendation === "recommended" ||
      c.rollbackRecommendation === "immediate"
  ).length;

  return {
    totalExperiments,
    runningExperiments,
    healthyExperiments,
    riskyExperiments,
    blockedExperiments,
  };
}

/**
 * Master dashboard builder function aggregating summary, cards, and alerts.
 */
export function buildDashboard(
  cards: DashboardExperimentCard[]
): DashboardState {
  const safeCards = cards || [];
  const summary = buildDashboardSummary(safeCards);
  const alerts = buildDashboardAlerts(safeCards);

  return {
    summary,
    cards: safeCards,
    alerts,
  };
}
