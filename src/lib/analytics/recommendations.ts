import type { RecommendationTarget } from "./recommendation-key";

export type RecommendationSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type RecommendationCategory =
  | "friction"
  | "provider"
  | "recovery"
  | "dropoff"
  | "conversion";

export type RecommendationKind =
  | "warning"
  | "insight";

export interface Recommendation {
  id: string;
  target: RecommendationTarget;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  kind: RecommendationKind;
  title: string;
  description: string;
  impact: string;
  evidence: string[];
  action: string;
  /** Optional impact score for insight ranking (higher = more useful). Ignored for warnings. */
  impactScore?: number;
}
