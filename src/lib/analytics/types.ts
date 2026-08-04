import type { SubmissionFailureReason } from "./validators";

/**
 * Valid time window ranges for filtering onboarding analytics.
 */
export type TimeRange = "24h" | "7d" | "30d" | "all";

/**
 * Forward-compatible failure reason type with fallback for unrecognized/legacy values.
 */
export type FailureReason = SubmissionFailureReason | "unknown";

/**
 * Detailed metrics for individual stage steps within the onboarding funnel.
 */
export interface FunnelStage {
  readonly stage: "start" | "step_1" | "step_2" | "step_3" | "submission";
  readonly count: number;
  readonly retentionRate: number;
  readonly dropOffRate: number;
}

/**
 * Breakdown of stage-to-stage drop-off percentages.
 */
export interface DropOffPercentages {
  readonly startToStep1: number;
  readonly step1ToStep2: number;
  readonly step2ToStep3: number;
  readonly step3ToSubmission: number;
}

/**
 * Complete conversion funnel and completion duration metrics.
 */
export interface FunnelMetrics {
  readonly totalStarts: number;
  readonly step1Completed: number;
  readonly step2Completed: number;
  readonly step3Completed: number;
  readonly totalCompletions: number;
  readonly conversionRate: number;
  readonly dropOffPercentages: DropOffPercentages;
  readonly stages: readonly FunnelStage[];
  readonly avgDurationSeconds: number;
  readonly medianDurationSeconds: number;
}

/**
 * Aggregated submission failure count and distribution metrics.
 */
export interface FailureMetric {
  readonly reason: FailureReason;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Quantitative metrics detailing founder interaction with draft saving and recovery.
 */
export interface DraftMetrics {
  readonly restoredCount: number;
  readonly discardedCount: number;
  readonly restoreDiscardRatio: number;
  readonly avgRestoreAgeHours: number;
  readonly avgDiscardAgeHours: number;
}

import type { AnalyticsFilters } from "./filters";

/**
 * Execution metadata for the generated metrics report.
 */
export interface AnalyticsSummary {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  /** Total analytics events represented across all dashboard metrics for the selected range. */
  readonly totalEvents: number;
}

/**
 * Root container interface representing the complete onboarding analytics payload.
 */
export interface OnboardingMetricsReport {
  readonly summary: AnalyticsSummary;
  readonly funnel: FunnelMetrics;
  readonly failures: readonly FailureMetric[];
  readonly drafts: DraftMetrics;
}
