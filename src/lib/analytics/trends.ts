import type { TimeRange } from "./types";
import type { RawOnboardingEventRecord } from "./events";
import { fetchOnboardingEvents } from "./events";

// ─── Trend Types ──────────────────────────────────────────────────────

export type Granularity = "hourly" | "daily" | "monthly";

export interface TrendPoint {
  readonly period: string;
  readonly count: number;
}

export interface RateTrendPoint {
  readonly period: string;
  readonly rate: number;
}

export interface TrendReportSummary {
  readonly range: TimeRange;
  readonly granularity: Granularity;
}

export interface TrendData {
  readonly starts: readonly TrendPoint[];
  readonly completions: readonly TrendPoint[];
  readonly conversion: readonly RateTrendPoint[];
  readonly draftRecovery: readonly RateTrendPoint[];
}

export interface TrendReport {
  readonly summary: TrendReportSummary;
  readonly trends: TrendData;
}

// ─── Granularity Mapping ──────────────────────────────────────────────

export function getGranularity(range: TimeRange): Granularity {
  switch (range) {
    case "24h":
      return "hourly";
    case "7d":
    case "30d":
      return "daily";
    case "all":
      return "monthly";
    default:
      return "daily";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getBucketKey(timestamp: string, granularity: Granularity): string {
  switch (granularity) {
    case "hourly":
      // YYYY-MM-DDTHH
      return timestamp.substring(0, 13);
    case "daily":
      // YYYY-MM-DD
      return timestamp.substring(0, 10);
    case "monthly":
      // YYYY-MM
      return timestamp.substring(0, 7);
    default:
      return timestamp.substring(0, 10);
  }
}

function formatBucketLabel(bucketKey: string, granularity: Granularity): string {
  switch (granularity) {
    case "hourly": {
      // "2026-08-03T14" → "2pm"
      const hour = parseInt(bucketKey.substring(11, 13), 10);
      const suffix = hour >= 12 ? "pm" : "am";
      const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${display}${suffix}`;
    }
    case "daily": {
      // "2026-08-03" → "Aug 3"
      const d = new Date(bucketKey + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    case "monthly": {
      // "2026-08" → "Aug 2026"
      const d = new Date(bucketKey + "-01T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    default:
      return bucketKey;
  }
}

function round1Decimal(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.max(0, Math.round(num * 10) / 10);
}

// ─── Trend Computation from Pre-filtered Event Records ────────────────

export function getStartsTrend(
  events: readonly RawOnboardingEventRecord[],
  granularity: Granularity
): readonly TrendPoint[] {
  const starts = events.filter((e) => e.event_name === "onboarding_started");
  return aggregateByBucket(starts.map((e) => e.created_at), granularity);
}

export function getCompletionsTrend(
  events: readonly RawOnboardingEventRecord[],
  granularity: Granularity
): readonly TrendPoint[] {
  const completions = events.filter((e) => e.event_name === "submission_completed");
  return aggregateByBucket(completions.map((e) => e.created_at), granularity);
}

export function getConversionTrend(
  events: readonly RawOnboardingEventRecord[],
  granularity: Granularity
): readonly RateTrendPoint[] {
  const relevant = events.filter((e) => e.event_name === "onboarding_started" || e.event_name === "submission_completed");
  if (relevant.length === 0) return [];

  const startsByBucket = new Map<string, number>();
  const completionsByBucket = new Map<string, number>();

  for (const row of relevant) {
    const key = getBucketKey(row.created_at, granularity);
    if (row.event_name === "onboarding_started") {
      startsByBucket.set(key, (startsByBucket.get(key) || 0) + 1);
    } else {
      completionsByBucket.set(key, (completionsByBucket.get(key) || 0) + 1);
    }
  }

  const allBuckets = [
    ...new Set([...startsByBucket.keys(), ...completionsByBucket.keys()]),
  ].sort();

  return allBuckets.map((bucket) => {
    const starts = startsByBucket.get(bucket) || 0;
    const completions = completionsByBucket.get(bucket) || 0;
    const rate = starts > 0 ? round1Decimal((completions / starts) * 100) : 0;
    return { period: formatBucketLabel(bucket, granularity), rate };
  });
}

export function getDraftRecoveryTrend(
  events: readonly RawOnboardingEventRecord[],
  granularity: Granularity
): readonly RateTrendPoint[] {
  const relevant = events.filter((e) => e.event_name === "draft_restored" || e.event_name === "draft_discarded");
  if (relevant.length === 0) return [];

  const restoredByBucket = new Map<string, number>();
  const totalByBucket = new Map<string, number>();

  for (const row of relevant) {
    const key = getBucketKey(row.created_at, granularity);
    totalByBucket.set(key, (totalByBucket.get(key) || 0) + 1);
    if (row.event_name === "draft_restored") {
      restoredByBucket.set(key, (restoredByBucket.get(key) || 0) + 1);
    }
  }

  const allBuckets = [...totalByBucket.keys()].sort();

  return allBuckets.map((bucket) => {
    const total = totalByBucket.get(bucket) || 0;
    const restored = restoredByBucket.get(bucket) || 0;
    const rate = total > 0 ? round1Decimal((restored / total) * 100) : 0;
    return { period: formatBucketLabel(bucket, granularity), rate };
  });
}

// ─── Main Orchestrator (Pure Aggregator) ──────────────────────────────

export async function buildTrendReport(
  eventsOrRange: readonly RawOnboardingEventRecord[] | TimeRange,
  rangeParam?: TimeRange
): Promise<TrendReport> {
  let events: readonly RawOnboardingEventRecord[];
  let range: TimeRange;

  if (typeof eventsOrRange === "string") {
    range = eventsOrRange;
    events = await fetchOnboardingEvents(range);
  } else {
    events = eventsOrRange;
    range = rangeParam || "7d";
  }

  const granularity = getGranularity(range);

  const starts = getStartsTrend(events, granularity);
  const completions = getCompletionsTrend(events, granularity);
  const conversion = getConversionTrend(events, granularity);
  const draftRecovery = getDraftRecoveryTrend(events, granularity);

  return {
    summary: {
      range,
      granularity,
    },
    trends: {
      starts,
      completions,
      conversion,
      draftRecovery,
    },
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────

function aggregateByBucket(
  timestamps: string[],
  granularity: Granularity
): readonly TrendPoint[] {
  const countsByBucket = new Map<string, number>();

  for (const ts of timestamps) {
    const key = getBucketKey(ts, granularity);
    countsByBucket.set(key, (countsByBucket.get(key) || 0) + 1);
  }

  const sorted = [...countsByBucket.keys()].sort();
  return sorted.map((bucket) => ({
    period: formatBucketLabel(bucket, granularity),
    count: countsByBucket.get(bucket) || 0,
  }));
}
