import type { StartupStatus } from "./startup-status";

export interface ScoreBreakdown {
  id: string;
  earned: number;
  possible: number;
  weight: number;
}

export interface FounderInsightsSnapshot {
  healthScore: number;
  completionScore: number;
  verificationProgress: number;
  signals: {
    passed: string[];
    failed: string[];
  };
  issues: string[];
  scoreBreakdown: ScoreBreakdown[];
}

interface HealthScoreSignal {
  id: string;
  weight: number;
  resolve: (status: StartupStatus) => boolean;
}

const HEALTH_SCORE_SIGNALS: HealthScoreSignal[] = [
  {
    id: "profile_completeness",
    weight: 10,
    resolve: (status) => status.profile === "complete",
  },
  {
    id: "revenue_declaration",
    weight: 10,
    resolve: (status) => status.revenue !== "undeclared",
  },
  {
    id: "trust",
    weight: 20,
    resolve: (status) => status.proof === "submitted" || status.payment === "connected" || status.verification === "verified",
  },
  {
    id: "provider_connection",
    weight: 30,
    resolve: (status) => status.payment === "connected",
  },
  {
    id: "verification",
    weight: 30,
    resolve: (status) => status.verification === "verified",
  },
  {
    id: "publication",
    weight: 0,
    resolve: (status) => status.publication === "public",
  }
];

export function getFounderInsightsSnapshot(status: StartupStatus): FounderInsightsSnapshot {
  if (!status) {
    return {
      healthScore: 0,
      completionScore: 0,
      verificationProgress: 0,
      signals: { passed: [], failed: [] },
      issues: [],
      scoreBreakdown: []
    };
  }

  const passed: string[] = [];
  const failed: string[] = [];
  const scoreBreakdown: ScoreBreakdown[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  HEALTH_SCORE_SIGNALS.forEach(signal => {
    const isPassed = signal.resolve(status);
    maxPossibleScore += signal.weight;
    
    if (isPassed) {
      totalScore += signal.weight;
      passed.push(signal.id);
    } else {
      failed.push(signal.id);
    }

    scoreBreakdown.push({
      id: signal.id,
      earned: isPassed ? signal.weight : 0,
      possible: signal.weight,
      weight: signal.weight
    });
  });

  const normalizedHealthScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  const verificationProgress = Math.round((passed.length / HEALTH_SCORE_SIGNALS.length) * 100);

  return {
    healthScore: normalizedHealthScore,
    completionScore: normalizedHealthScore,
    verificationProgress,
    signals: {
      passed,
      failed
    },
    issues: failed,
    scoreBreakdown
  };
}
