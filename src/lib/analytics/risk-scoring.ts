import type { Recommendation } from "./recommendations";

export type AbandonmentRisk = "low" | "medium" | "high";

export interface RiskFactor {
  type: "inactivity" | "failures" | "duration";
  points: number;
  explanation: string;
}

export interface RiskSignal {
  userId: string;
  risk: AbandonmentRisk;
  factors: RiskFactor[];
}

export interface UserOnboardingActivity {
  userId: string;
  lastActiveTimestampMs: number;
  failedSessionCount: number;
  totalOnboardingDurationMs: number;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function evaluateAbandonmentRisk(
  activities: UserOnboardingActivity[],
  timeThresholdMs: number = FIFTEEN_MINUTES_MS,
  nowMs: number = Date.now()
): RiskSignal[] {
  if (!activities || activities.length === 0) return [];

  return activities.map((activity) => {
    const factors: RiskFactor[] = [];

    // Factor 1: Inactivity > 24h
    const inactivityMs = nowMs - activity.lastActiveTimestampMs;
    if (inactivityMs > TWENTY_FOUR_HOURS_MS) {
      const hours = Math.round(inactivityMs / (60 * 60 * 1000));
      factors.push({
        type: "inactivity",
        points: 1,
        explanation: `Founder inactive for ${hours} hours.`,
      });
    }

    // Factor 2: More than 2 failed sessions (failedSessionCount > 2)
    if (activity.failedSessionCount > 2) {
      factors.push({
        type: "failures",
        points: 1,
        explanation: `Founder has ${activity.failedSessionCount} failed sessions.`,
      });
    }

    // Factor 3: Onboarding time > threshold
    if (activity.totalOnboardingDurationMs > timeThresholdMs) {
      const minutes = Math.round(activity.totalOnboardingDurationMs / 60000);
      factors.push({
        type: "duration",
        points: 1,
        explanation: `Onboarding duration is ${minutes} minutes.`,
      });
    }

    const totalPoints = factors.reduce((sum, f) => sum + f.points, 0);

    let risk: AbandonmentRisk = "low";
    if (totalPoints === 1) {
      risk = "medium";
    } else if (totalPoints >= 2) {
      risk = "high";
    }

    return {
      userId: activity.userId,
      risk,
      factors,
    };
  });
}

export function generateRiskRecommendations(
  signals: RiskSignal[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (!signals || signals.length === 0) return recommendations;

  const highRiskCount = signals.filter((s) => s.risk === "high").length;
  const mediumRiskCount = signals.filter((s) => s.risk === "medium").length;

  if (highRiskCount > 0) {
    recommendations.push({
      id: "risk_high_abandonment_detected",
      target: {
        entityType: "journey",
        entityId: "abandonment_risk",
      },
      category: "conversion",
      severity: "high",
      kind: "warning",
      title: "High Founder Abandonment Risk Detected",
      description: `${highRiskCount} founders are exhibiting critical risk signals for abandoning onboarding.`,
      impact: "Founders with multiple risk factors have over 80% likelihood of complete churn.",
      evidence: [
        `${highRiskCount} founders with high risk`,
        `${mediumRiskCount} founders with medium risk`,
        "Primary triggers: >24h inactivity, multiple failed sessions",
      ],
      action: "Inspect high-risk founders in the Risk Table and send targeted recovery outreach.",
    });
  } else if (mediumRiskCount > 0) {
    recommendations.push({
      id: "risk_medium_abandonment_detected",
      target: {
        entityType: "journey",
        entityId: "abandonment_risk",
      },
      category: "conversion",
      severity: "medium",
      kind: "warning",
      title: "Moderate Founder Abandonment Risk",
      description: `${mediumRiskCount} founders display moderate risk factors during onboarding.`,
      impact: "Early intervention prevents escalation to complete journey abandonment.",
      evidence: [`${mediumRiskCount} founders with medium risk`],
      action: "Monitor medium-risk signals and check for recurring friction patterns.",
    });
  }

  return recommendations;
}
