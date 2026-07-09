import type { FounderInsightsSnapshot } from "./founder-insights-engine";
import type { Recommendation } from "./recommendation-engine";

export interface InsightItem {
  id: string;
  label: string;
}

export interface DashboardInsights {
  healthScore: number;
  healthGrade: string;
  summary: string;
  messaging: string;
  strengths: InsightItem[];
  improvements: InsightItem[];
  primaryRecommendation: Recommendation | null;
  secondaryRecommendations: Recommendation[];
  verificationProgress: number;
}

const STRENGTH_LABELS: Record<string, string> = {
  profile_completeness: "Profile completed",
  revenue_declaration: "Revenue declared",
  provider_connection: "Provider connected",
  verification: "Verification completed",
  trust: "Trust evidence received",
  publication: "Public profile published"
};

const IMPROVEMENT_LABELS: Record<string, string> = {
  profile_completeness: "Complete your profile to enable verification.",
  revenue_declaration: "Declare your revenue to start the verification process.",
  provider_connection: "Connect a payment provider to enable automatic revenue verification.",
  verification: "Complete verification to unlock your public profile.",
  trust: "Provide additional proof or connect a provider to build trust.",
  publication: "Publish your verified startup to get discovered."
};

export function getDashboardInsights(
  snapshot: FounderInsightsSnapshot, 
  insightsRecommendations: Recommendation[]
): DashboardInsights {
  const { healthScore, signals, verificationProgress } = snapshot;

  // 1. Determine Grade and Messaging
  let healthGrade = "";
  let summary = "";
  let messaging = "";

  if (healthScore >= 95) {
    healthGrade = "Excellent";
    summary = "Your startup is in excellent shape.";
    messaging = "You have established strong trust signals.";
  } else if (healthScore >= 80) {
    healthGrade = "Great Progress";
    summary = "Your profile is almost ready to build investor trust.";
    messaging = "Complete the remaining steps to maximize your visibility.";
  } else if (healthScore >= 65) {
    healthGrade = "Good Progress";
    summary = "You are on the right track.";
    messaging = "Keep improving your profile to unlock verification.";
  } else if (healthScore >= 45) {
    healthGrade = "Needs Attention";
    summary = "Action is required to build trust and verify your revenue.";
    messaging = "Follow the recommendations to improve your score.";
  } else {
    healthGrade = "Getting Started";
    summary = "Welcome to Verifii. Let's get your startup verified.";
    messaging = "Follow the recommendations to begin your journey.";
  }

  // 2. Map Strengths and Improvements
  const strengths: InsightItem[] = signals.passed.map(id => ({
    id,
    label: STRENGTH_LABELS[id] || id
  }));

  const improvements: InsightItem[] = signals.failed.map(id => ({
    id,
    label: IMPROVEMENT_LABELS[id] || id
  }));

  // 3. Determine Primary and Secondary Recommendations from injected array
  let primaryRecommendation: Recommendation | null = null;
  let secondaryRecommendations: Recommendation[] = [];

  if (insightsRecommendations.length > 0) {
    primaryRecommendation = insightsRecommendations[0];
    secondaryRecommendations = insightsRecommendations.slice(1);
  }

  return {
    healthScore,
    healthGrade,
    summary,
    messaging,
    strengths,
    improvements,
    primaryRecommendation,
    secondaryRecommendations,
    verificationProgress
  };
}
