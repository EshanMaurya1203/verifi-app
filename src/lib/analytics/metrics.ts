import { validateFailureReason } from "./validators";
import type { RawOnboardingEventRecord } from "./events";
import { fetchOnboardingEvents } from "./events";
import type {
  TimeRange,
  FunnelMetrics,
  FailureMetric,
  DraftMetrics,
  OnboardingMetricsReport,
  FailureReason,
  FunnelStage,
} from "./types";
import type { AnalyticsFilters } from "./filters";

function round1Decimal(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.max(0, Math.round(num * 10) / 10);
}

function round2Decimals(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.max(0, Math.round(num * 100) / 100);
}

// ─── Query 1: Funnel & Conversion Aggregation ────────────────────────

const EMPTY_FUNNEL_METRICS: FunnelMetrics = {
  totalStarts: 0,
  step1Completed: 0,
  step2Completed: 0,
  step3Completed: 0,
  totalCompletions: 0,
  conversionRate: 0.0,
  dropOffPercentages: {
    startToStep1: 0.0,
    step1ToStep2: 0.0,
    step2ToStep3: 0.0,
    step3ToSubmission: 0.0,
  },
  stages: [
    { stage: "start", count: 0, retentionRate: 100.0, dropOffRate: 0.0 },
    { stage: "step_1", count: 0, retentionRate: 0.0, dropOffRate: 0.0 },
    { stage: "step_2", count: 0, retentionRate: 0.0, dropOffRate: 0.0 },
    { stage: "step_3", count: 0, retentionRate: 0.0, dropOffRate: 0.0 },
    { stage: "submission", count: 0, retentionRate: 0.0, dropOffRate: 0.0 },
  ],
  avgDurationSeconds: 0,
  medianDurationSeconds: 0,
};

export function getFunnelMetrics(events: readonly RawOnboardingEventRecord[]): FunnelMetrics {
  if (!events || events.length === 0) {
    return EMPTY_FUNNEL_METRICS;
  }

  const startsSet = new Set<string>();
  const step1Set = new Set<string>();
  const step2Set = new Set<string>();
  const step3Set = new Set<string>();
  const completionsSet = new Set<string>();
  const durations: number[] = [];

  for (const row of events) {
    const userId = row.user_id;
    const event = row.event_name;

    if (event === "onboarding_started" && userId) startsSet.add(userId);
    else if (event === "step_1_completed" && userId) step1Set.add(userId);
    else if (event === "step_2_completed" && userId) step2Set.add(userId);
    else if (event === "step_3_completed" && userId) step3Set.add(userId);
    else if (event === "submission_completed") {
      if (userId) completionsSet.add(userId);
      const meta = row.metadata as Record<string, unknown> | null;
      if (meta && typeof meta.duration === "number" && Number.isFinite(meta.duration) && meta.duration > 0) {
        durations.push(meta.duration);
      }
    }
  }

  const totalStarts = startsSet.size;
  const step1Completed = step1Set.size;
  const step2Completed = step2Set.size;
  const step3Completed = step3Set.size;
  const totalCompletions = completionsSet.size;

  const conversionRate = totalStarts > 0 ? round1Decimal((totalCompletions / totalStarts) * 100) : 0.0;

  const startToStep1 = totalStarts > 0 ? round1Decimal(Math.max(0, (1 - step1Completed / totalStarts) * 100)) : 0.0;
  const step1ToStep2 = step1Completed > 0 ? round1Decimal(Math.max(0, (1 - step2Completed / step1Completed) * 100)) : 0.0;
  const step2ToStep3 = step2Completed > 0 ? round1Decimal(Math.max(0, (1 - step3Completed / step2Completed) * 100)) : 0.0;
  const step3ToSubmission = step3Completed > 0 ? round1Decimal(Math.max(0, (1 - totalCompletions / step3Completed) * 100)) : 0.0;

  const stages: readonly FunnelStage[] = [
    { stage: "start", count: totalStarts, retentionRate: 100.0, dropOffRate: 0.0 },
    { stage: "step_1", count: step1Completed, retentionRate: totalStarts > 0 ? round1Decimal((step1Completed / totalStarts) * 100) : 0.0, dropOffRate: startToStep1 },
    { stage: "step_2", count: step2Completed, retentionRate: totalStarts > 0 ? round1Decimal((step2Completed / totalStarts) * 100) : 0.0, dropOffRate: step1ToStep2 },
    { stage: "step_3", count: step3Completed, retentionRate: totalStarts > 0 ? round1Decimal((step3Completed / totalStarts) * 100) : 0.0, dropOffRate: step2ToStep3 },
    { stage: "submission", count: totalCompletions, retentionRate: totalStarts > 0 ? round1Decimal((totalCompletions / totalStarts) * 100) : 0.0, dropOffRate: step3ToSubmission },
  ];

  let avgDurationSeconds = 0;
  let medianDurationSeconds = 0;

  if (durations.length > 0) {
    const sum = durations.reduce((acc, val) => acc + val, 0);
    avgDurationSeconds = Math.round(sum / durations.length);

    const sorted = [...durations].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      medianDurationSeconds = Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      medianDurationSeconds = Math.round(sorted[mid]);
    }
  }

  return {
    totalStarts,
    step1Completed,
    step2Completed,
    step3Completed,
    totalCompletions,
    conversionRate,
    dropOffPercentages: {
      startToStep1,
      step1ToStep2,
      step2ToStep3,
      step3ToSubmission,
    },
    stages,
    avgDurationSeconds,
    medianDurationSeconds,
  };
}

// ─── Query 2: Submission Failure Aggregation ──────────────────────────

export function getFailureBreakdown(events: readonly RawOnboardingEventRecord[]): readonly FailureMetric[] {
  if (!events || events.length === 0) {
    return [];
  }

  const failureRows = events.filter((e) => e.event_name === "submission_failed");
  if (failureRows.length === 0) {
    return [];
  }

  const countsMap = new Map<FailureReason, number>();

  for (const row of failureRows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const rawReason = meta?.reason;
    const validReason = validateFailureReason(rawReason);
    const reason: FailureReason = validReason ?? "unknown";

    countsMap.set(reason, (countsMap.get(reason) || 0) + 1);
  }

  const totalFailures = failureRows.length;
  const failures: FailureMetric[] = [];

  for (const [reason, count] of countsMap.entries()) {
    failures.push({
      reason,
      count,
      percentage: totalFailures > 0 ? round1Decimal((count / totalFailures) * 100) : 0.0,
    });
  }

  failures.sort((a, b) => b.count - a.count);
  return failures;
}

// ─── Query 3: Draft Lifecycle Aggregation ─────────────────────────────

const EMPTY_DRAFT_METRICS: DraftMetrics = {
  restoredCount: 0,
  discardedCount: 0,
  restoreDiscardRatio: 0.0,
  avgRestoreAgeHours: 0.0,
  avgDiscardAgeHours: 0.0,
};

export function getDraftMetrics(events: readonly RawOnboardingEventRecord[]): DraftMetrics {
  if (!events || events.length === 0) {
    return EMPTY_DRAFT_METRICS;
  }

  const draftRows = events.filter((e) => e.event_name === "draft_restored" || e.event_name === "draft_discarded");
  if (draftRows.length === 0) {
    return EMPTY_DRAFT_METRICS;
  }

  let restoredCount = 0;
  let discardedCount = 0;
  let restoreAgeSum = 0;
  let restoreAgeCount = 0;
  let discardAgeSum = 0;
  let discardAgeCount = 0;

  for (const row of draftRows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const age = meta && typeof meta.draft_age_hours === "number" && Number.isFinite(meta.draft_age_hours)
      ? meta.draft_age_hours
      : undefined;

    if (row.event_name === "draft_restored") {
      restoredCount++;
      if (age !== undefined && age >= 0) {
        restoreAgeSum += age;
        restoreAgeCount++;
      }
    } else if (row.event_name === "draft_discarded") {
      discardedCount++;
      if (age !== undefined && age >= 0) {
        discardAgeSum += age;
        discardAgeCount++;
      }
    }
  }

  const restoreDiscardRatio = discardedCount > 0
    ? round2Decimals(restoredCount / discardedCount)
    : restoredCount;

  const avgRestoreAgeHours = restoreAgeCount > 0
    ? round1Decimal(restoreAgeSum / restoreAgeCount)
    : 0.0;

  const avgDiscardAgeHours = discardAgeCount > 0
    ? round1Decimal(discardAgeSum / discardAgeCount)
    : 0.0;

  return {
    restoredCount,
    discardedCount,
    restoreDiscardRatio,
    avgRestoreAgeHours,
    avgDiscardAgeHours,
  };
}

// ─── Main Orchestrator (Pure Aggregator) ──────────────────────────────

export async function buildAnalyticsReport(
  eventsOrRange: readonly RawOnboardingEventRecord[] | TimeRange,
  rangeParam?: TimeRange,
  filters?: AnalyticsFilters
): Promise<OnboardingMetricsReport> {
  let events: readonly RawOnboardingEventRecord[];
  let range: TimeRange;

  if (typeof eventsOrRange === "string") {
    range = eventsOrRange;
    events = await fetchOnboardingEvents(range);
  } else {
    events = eventsOrRange;
    range = rangeParam || "7d";
  }

  const funnel = getFunnelMetrics(events);
  const failures = getFailureBreakdown(events);
  const drafts = getDraftMetrics(events);

  return {
    summary: {
      generatedAt: new Date().toISOString(),
      range,
      filters,
      totalEvents: events.length,
    },
    funnel,
    failures,
    drafts,
  };
}
