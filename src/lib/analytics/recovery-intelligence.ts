import type { RecoveryReport } from "./recovery-metrics";
import type { Recommendation } from "./recommendations";

export function analyzeRecovery(
  report: RecoveryReport
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (!report) return recommendations;

  const { recoveryRate, unrecoveredFounders, recoveredFounders } = report;

  // Rule 1: Recovery rate < 20% -> HIGH severity warning
  if (recoveryRate < 20) {
    recommendations.push({
      id: "recovery_rate_critical_low",
      target: {
        entityType: "recovery",
        entityId: "global",
      },
      category: "recovery",
      severity: "high",
      kind: "warning",
      title: "Critical Low Onboarding Recovery Rate",
      description: `Recovery rate is currently ${recoveryRate}%, below the critical 20% threshold.`,
      impact: "Founders who abandon or fail onboarding sessions rarely return, resulting in lost conversions.",
      evidence: [
        `Recovery rate: ${recoveryRate}%`,
        `Unrecovered founders: ${unrecoveredFounders}`,
      ],
      action: "Implement automated re-engagement emails and single-click session recovery links.",
    });
  }
  // Rule 2: Recovery rate between 20% and 40% -> MEDIUM severity warning
  else if (recoveryRate >= 20 && recoveryRate <= 40) {
    recommendations.push({
      id: "recovery_rate_suboptimal",
      target: {
        entityType: "recovery",
        entityId: "global",
      },
      category: "recovery",
      severity: "medium",
      kind: "warning",
      title: "Suboptimal Onboarding Recovery Rate",
      description: `Recovery rate is currently ${recoveryRate}%, between 20% and 40%.`,
      impact: "A notable portion of abandoned founders could be recovered with proactive intervention.",
      evidence: [
        `Recovery rate: ${recoveryRate}%`,
        `Recovered founders: ${recoveredFounders}`,
        `Unrecovered founders: ${unrecoveredFounders}`,
      ],
      action: "Refine draft auto-save mechanisms and send targeted recovery nudges within 24 hours.",
    });
  }
  // Rule 3: Recovery rate > 70% -> LOW severity insight
  else if (recoveryRate > 70) {
    recommendations.push({
      id: "recovery_rate_strong_insight",
      target: {
        entityType: "recovery",
        entityId: "global",
      },
      category: "recovery",
      severity: "low",
      kind: "insight",
      title: "Strong Onboarding Recovery Performance",
      description: `Over ${recoveryRate}% of at-risk founders successfully return and complete onboarding.`,
      impact: "High recovery rates minimize effective churn from temporary drop-offs.",
      evidence: [
        `Recovery rate: ${recoveryRate}%`,
        `Recovered founders: ${recoveredFounders}`,
      ],
      action: "Maintain current recovery communication workflows and monitor cohort metrics.",
      impactScore: Math.round(recoveryRate),
    });
  }

  return recommendations;
}
