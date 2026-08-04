import type { TimeRange } from "./types";
import type { RawOnboardingEventRecord } from "./events";
import { fetchOnboardingEventsForWindow } from "./events";

// ─── Comparison Types ──────────────────────────────────────────────────

export type ComparisonDirection = "up" | "down" | "neutral";

export interface ComparisonMetric {
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly deltaPercentage: number;
  readonly direction: ComparisonDirection;
}

export interface ComparisonMetrics {
  readonly starts: ComparisonMetric;
  readonly completions: ComparisonMetric;
  readonly conversionRate: ComparisonMetric;
  readonly averageDuration: ComparisonMetric;
  readonly draftRecoveryRate: ComparisonMetric;
}

export interface ComparisonReportSummary {
  readonly range: TimeRange;
  readonly comparisonEnabled: boolean;
}

export interface ComparisonReport {
  readonly summary: ComparisonReportSummary;
  readonly metrics: ComparisonMetrics | null;
}

export interface DateWindow {
  readonly start: string;
  readonly end: string;
}

export interface ComparisonWindows {
  readonly current: DateWindow;
  readonly previous: DateWindow;
}

// ─── Helper Functions ──────────────────────────────────────────────────

function round1Decimal(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.max(0, Math.round(num * 10) / 10);
}

function round2Decimals(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.round(num * 100) / 100;
}

/**
 * Calculates current and previous time windows based on the selected range.
 * Returns null for "all" range as period comparison is disabled.
 */
export function getComparisonWindow(range: TimeRange): ComparisonWindows | null {
  if (range === "all") return null;

  const now = new Date();
  const nowMs = now.getTime();

  let windowMs: number;
  switch (range) {
    case "24h":
      windowMs = 24 * 60 * 60 * 1000;
      break;
    case "7d":
      windowMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case "30d":
      windowMs = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  const currentStart = new Date(nowMs - windowMs).toISOString();
  const currentEnd = now.toISOString();

  const previousStart = new Date(nowMs - 2 * windowMs).toISOString();
  const previousEnd = currentStart;

  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: previousEnd },
  };
}

export function calculateDelta(current: number, previous: number): number {
  return round2Decimals(current - previous);
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return round2Decimals(((current - previous) / previous) * 100);
}

export function calculateDirection(delta: number): ComparisonDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

export function buildComparisonMetric(current: number, previous: number): ComparisonMetric {
  const delta = calculateDelta(current, previous);
  const deltaPercentage = calculatePercentageChange(current, previous);
  const direction = calculateDirection(delta);

  return {
    current,
    previous,
    delta,
    deltaPercentage,
    direction,
  };
}

export interface PeriodRawMetrics {
  readonly starts: number;
  readonly completions: number;
  readonly conversionRate: number;
  readonly averageDuration: number;
  readonly draftRecoveryRate: number;
}

export function computePeriodRawMetrics(events: readonly RawOnboardingEventRecord[]): PeriodRawMetrics {
  if (!events || events.length === 0) {
    return {
      starts: 0,
      completions: 0,
      conversionRate: 0,
      averageDuration: 0,
      draftRecoveryRate: 0,
    };
  }

  const startsSet = new Set<string>();
  const completionsSet = new Set<string>();
  const durations: number[] = [];
  let restoredCount = 0;
  let discardedCount = 0;

  for (const row of events) {
    const event = row.event_name;
    const userId = row.user_id;

    if (event === "onboarding_started" && userId) {
      startsSet.add(userId);
    } else if (event === "submission_completed") {
      if (userId) completionsSet.add(userId);
      const meta = row.metadata as Record<string, unknown> | null;
      if (meta && typeof meta.duration === "number" && Number.isFinite(meta.duration) && meta.duration > 0) {
        durations.push(meta.duration);
      }
    } else if (event === "draft_restored") {
      restoredCount++;
    } else if (event === "draft_discarded") {
      discardedCount++;
    }
  }

  const starts = startsSet.size;
  const completions = completionsSet.size;
  const conversionRate = starts > 0 ? round1Decimal((completions / starts) * 100) : 0;
  const averageDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const totalDrafts = restoredCount + discardedCount;
  const draftRecoveryRate = totalDrafts > 0 ? round1Decimal((restoredCount / totalDrafts) * 100) : 0;

  return {
    starts,
    completions,
    conversionRate,
    averageDuration,
    draftRecoveryRate,
  };
}

// ─── Main Orchestrator (Pure Aggregator) ──────────────────────────────

export async function buildComparisonReport(
  currentEventsOrRange: readonly RawOnboardingEventRecord[] | TimeRange,
  previousEventsParam?: readonly RawOnboardingEventRecord[],
  rangeParam?: TimeRange
): Promise<ComparisonReport> {
  let range: TimeRange;
  let currentMetrics: PeriodRawMetrics;
  let previousMetrics: PeriodRawMetrics;

  if (typeof currentEventsOrRange === "string") {
    range = currentEventsOrRange;
    const windows = getComparisonWindow(range);

    if (!windows) {
      return {
        summary: {
          range,
          comparisonEnabled: false,
        },
        metrics: null,
      };
    }

    const [currentEvents, previousEvents] = await Promise.all([
      fetchOnboardingEventsForWindow(windows.current),
      fetchOnboardingEventsForWindow(windows.previous),
    ]);

    currentMetrics = computePeriodRawMetrics(currentEvents);
    previousMetrics = computePeriodRawMetrics(previousEvents);
  } else {
    range = rangeParam || "7d";

    if (range === "all") {
      return {
        summary: {
          range,
          comparisonEnabled: false,
        },
        metrics: null,
      };
    }

    currentMetrics = computePeriodRawMetrics(currentEventsOrRange);
    previousMetrics = computePeriodRawMetrics(previousEventsParam || []);
  }

  const metrics: ComparisonMetrics = {
    starts: buildComparisonMetric(currentMetrics.starts, previousMetrics.starts),
    completions: buildComparisonMetric(currentMetrics.completions, previousMetrics.completions),
    conversionRate: buildComparisonMetric(currentMetrics.conversionRate, previousMetrics.conversionRate),
    averageDuration: buildComparisonMetric(currentMetrics.averageDuration, previousMetrics.averageDuration),
    draftRecoveryRate: buildComparisonMetric(currentMetrics.draftRecoveryRate, previousMetrics.draftRecoveryRate),
  };

  return {
    summary: {
      range,
      comparisonEnabled: true,
    },
    metrics,
  };
}
