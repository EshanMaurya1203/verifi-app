import { buildAnalyticsReport } from "./metrics";
import { buildTrendReport, TrendData } from "./trends";
import { buildComparisonReport, ComparisonMetrics, getComparisonWindow } from "./comparison";
import type { TimeRange, FunnelMetrics, FailureMetric, DraftMetrics } from "./types";
import { fetchOnboardingEvents, fetchOnboardingEventsForWindow, type RawOnboardingEventRecord } from "./events";
import { applyAnalyticsFilters } from "./filter-engine";
import { normalizeFilters, type AnalyticsFilters } from "./filters";
import { buildFounderJourneys } from "./journey-builder";
import {
  buildDiagnosticsReport,
  findDropOffPoints,
  findSlowSteps,
  findStuckFounders,
  DiagnosticsReport,
  DropOffPoint,
  StepDuration,
} from "./diagnostics";
import { FounderJourney } from "./journey";
import { buildFounderRecoveries } from "./recovery-engine";
import {
  buildRecoveryReport,
  findRecoveredJourneys,
  findUnrecoveredJourneys,
  type RecoveryReport,
} from "./recovery-metrics";
import type { FounderRecovery } from "./recovery";
import type { Recommendation } from "./recommendations";
import type { RiskSignal, UserOnboardingActivity } from "./risk-scoring";
import { evaluateAbandonmentRisk } from "./risk-scoring";
import { buildRecommendations } from "./recommendation-engine";
import { extractProvider } from "./provider-extractor";

export type ExportFormat = "csv" | "json";

export type ExportType =
  | "full"
  | "funnel"
  | "trends"
  | "comparison"
  | "failures"
  | "drafts"
  | "diagnostics"
  | "recovery"
  | "recommendations";

// ─── Export Payload Interfaces ────────────────────────────────────────

export interface FullExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly analytics: {
    readonly funnel: FunnelMetrics;
    readonly trends: TrendData;
    readonly comparison: ComparisonMetrics | null;
    readonly failures: readonly FailureMetric[];
    readonly drafts: DraftMetrics;
  };
}

export interface FunnelExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly funnel: FunnelMetrics;
}

export interface TrendsExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly trends: TrendData;
}

export interface ComparisonExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly comparison: ComparisonMetrics | null;
}

export interface FailuresExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly failures: readonly FailureMetric[];
}

export interface DraftsExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly drafts: DraftMetrics;
}

export interface DiagnosticsExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly diagnostics: DiagnosticsReport;
  readonly dropOffs: readonly DropOffPoint[];
  readonly slowSteps: readonly StepDuration[];
  readonly stuckFounders: readonly FounderJourney[];
}

export interface RecoveryExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly recovery: RecoveryReport;
  readonly recovered: readonly FounderRecovery[];
  readonly unrecovered: readonly FounderRecovery[];
}

export interface RecommendationsExportPayload {
  readonly generatedAt: string;
  readonly range: TimeRange;
  readonly filters?: AnalyticsFilters;
  readonly warnings: readonly Recommendation[];
  readonly insights: readonly Recommendation[];
  readonly riskSignals: readonly RiskSignal[];
}

export type ExportPayload =
  | FullExportPayload
  | FunnelExportPayload
  | TrendsExportPayload
  | ComparisonExportPayload
  | FailuresExportPayload
  | DraftsExportPayload
  | DiagnosticsExportPayload
  | RecoveryExportPayload
  | RecommendationsExportPayload;

// ─── File Name Generator ──────────────────────────────────────────────

export function generateFileName(
  type: ExportType,
  range: TimeRange,
  format: ExportFormat,
  filters?: AnalyticsFilters,
  dateStr?: string
): string {
  const d = dateStr || new Date().toISOString().substring(0, 10);
  const ext = format === "csv" ? "csv" : "json";
  const filterSuffix = filters && (filters.provider !== "all" || filters.outcome !== "all")
    ? `-${filters.provider}-${filters.outcome}`
    : "";
  return `onboarding-${type}-${range}${filterSuffix}-${d}.${ext}`;
}

// ─── Build Export Payload ─────────────────────────────────────────────

export async function buildExportPayload(
  type: ExportType,
  range: TimeRange,
  filters?: AnalyticsFilters
): Promise<ExportPayload> {
  const generatedAt = new Date().toISOString();
  const normFilters = normalizeFilters(filters?.provider, filters?.outcome);

  const rawEvents = await fetchOnboardingEvents(range);
  const filteredEvents = applyAnalyticsFilters(rawEvents, normFilters);

  if (type === "full") {
    const windows = getComparisonWindow(range);
    let comparisonReport = null;

    if (windows) {
      const [rawCurrent, rawPrevious] = await Promise.all([
        fetchOnboardingEventsForWindow(windows.current),
        fetchOnboardingEventsForWindow(windows.previous),
      ]);
      const currentFiltered = applyAnalyticsFilters(rawCurrent, normFilters);
      const previousFiltered = applyAnalyticsFilters(rawPrevious, normFilters);
      comparisonReport = await buildComparisonReport(currentFiltered, previousFiltered, range);
    } else {
      comparisonReport = await buildComparisonReport([], [], range);
    }

    const [analyticsReport, trendReport] = await Promise.all([
      buildAnalyticsReport(filteredEvents, range, normFilters),
      buildTrendReport(filteredEvents, range),
    ]);

    return {
      generatedAt,
      range,
      filters: normFilters,
      analytics: {
        funnel: analyticsReport.funnel,
        trends: trendReport.trends,
        comparison: comparisonReport.metrics,
        failures: analyticsReport.failures,
        drafts: analyticsReport.drafts,
      },
    };
  }

  if (type === "funnel") {
    const report = await buildAnalyticsReport(filteredEvents, range, normFilters);
    return {
      generatedAt,
      range,
      filters: normFilters,
      funnel: report.funnel,
    };
  }

  if (type === "trends") {
    const report = await buildTrendReport(filteredEvents, range);
    return {
      generatedAt,
      range,
      filters: normFilters,
      trends: report.trends,
    };
  }

  if (type === "comparison") {
    const windows = getComparisonWindow(range);
    let comparisonReport;

    if (windows) {
      const [rawCurrent, rawPrevious] = await Promise.all([
        fetchOnboardingEventsForWindow(windows.current),
        fetchOnboardingEventsForWindow(windows.previous),
      ]);
      const currentFiltered = applyAnalyticsFilters(rawCurrent, normFilters);
      const previousFiltered = applyAnalyticsFilters(rawPrevious, normFilters);
      comparisonReport = await buildComparisonReport(currentFiltered, previousFiltered, range);
    } else {
      comparisonReport = await buildComparisonReport([], [], range);
    }

    return {
      generatedAt,
      range,
      filters: normFilters,
      comparison: comparisonReport.metrics,
    };
  }

  if (type === "failures") {
    const report = await buildAnalyticsReport(filteredEvents, range, normFilters);
    return {
      generatedAt,
      range,
      filters: normFilters,
      failures: report.failures,
    };
  }

  if (type === "drafts") {
    const report = await buildAnalyticsReport(filteredEvents, range, normFilters);
    return {
      generatedAt,
      range,
      filters: normFilters,
      drafts: report.drafts,
    };
  }

  if (type === "diagnostics") {
    const journeys = buildFounderJourneys(filteredEvents);
    const diagnostics = buildDiagnosticsReport(journeys);
    const dropOffs = findDropOffPoints(journeys);
    const slowSteps = findSlowSteps(journeys);
    const stuckFounders = findStuckFounders(journeys);

    return {
      generatedAt,
      range,
      filters: normFilters,
      diagnostics,
      dropOffs,
      slowSteps,
      stuckFounders,
    };
  }

  if (type === "recovery") {
    const journeys = buildFounderJourneys(filteredEvents);
    const recoveries = buildFounderRecoveries(journeys);
    const report = buildRecoveryReport(recoveries);
    const recoveredList = findRecoveredJourneys(recoveries);
    const unrecoveredList = findUnrecoveredJourneys(recoveries);

    return {
      generatedAt,
      range,
      filters: normFilters,
      recovery: report,
      recovered: recoveredList,
      unrecovered: unrecoveredList,
    };
  }

  if (type === "recommendations") {
    const journeys = buildFounderJourneys(filteredEvents);
    const diagnostics = buildDiagnosticsReport(journeys);
    const recoveries = buildFounderRecoveries(journeys);
    const recoveryReport = buildRecoveryReport(recoveries);

    const providerMetrics = buildProviderMetricsFromEvents(filteredEvents);
    const riskSignals = buildRiskSignalsFromJourneys(journeys);

    const result = buildRecommendations({
      diagnostics,
      recovery: recoveryReport,
      providerMetrics,
      riskSignals,
    });

    return {
      generatedAt,
      range,
      filters: normFilters,
      warnings: result.warnings,
      insights: result.insights,
      riskSignals,
    };
  }

  throw new Error(`Unsupported export type: ${type}`);
}

// ─── CSV Converters (Single dataset only) ─────────────────────────────

function sanitizeCsvValue(val: string | number): string {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertFunnelToCsv(funnel: FunnelMetrics): string {
  const lines = [
    "metric,value",
    `starts,${funnel.totalStarts}`,
    `step_1_completed,${funnel.step1Completed}`,
    `step_2_completed,${funnel.step2Completed}`,
    `step_3_completed,${funnel.step3Completed}`,
    `completions,${funnel.totalCompletions}`,
    `conversion_rate,${funnel.conversionRate}`,
    `average_duration_seconds,${funnel.avgDurationSeconds}`,
    `median_duration_seconds,${funnel.medianDurationSeconds}`,
  ];
  return lines.join("\n");
}

function convertTrendsToCsv(trends: TrendData): string {
  const starts = trends.starts || [];
  const completions = trends.completions || [];
  const conversion = trends.conversion || [];
  const recovery = trends.draftRecovery || [];

  const periodsSet = new Set<string>();
  starts.forEach((p) => periodsSet.add(p.period));
  completions.forEach((p) => periodsSet.add(p.period));
  conversion.forEach((p) => periodsSet.add(p.period));
  recovery.forEach((p) => periodsSet.add(p.period));

  const startsMap = new Map(starts.map((p) => [p.period, p.count]));
  const completionsMap = new Map(completions.map((p) => [p.period, p.count]));
  const conversionMap = new Map(conversion.map((p) => [p.period, p.rate]));
  const recoveryMap = new Map(recovery.map((p) => [p.period, p.rate]));

  const lines = ["period,starts,completions,conversion_rate,draft_recovery_rate"];
  periodsSet.forEach((period) => {
    const s = startsMap.get(period) ?? 0;
    const c = completionsMap.get(period) ?? 0;
    const cr = conversionMap.get(period) ?? 0;
    const dr = recoveryMap.get(period) ?? 0;
    lines.push(`${sanitizeCsvValue(period)},${s},${c},${cr},${dr}`);
  });

  return lines.join("\n");
}

function convertComparisonToCsv(comparison: ComparisonMetrics | null): string {
  const lines = ["metric,current,previous,delta,delta_percentage,direction"];
  if (!comparison) {
    lines.push("comparison_disabled_for_all_time,0,0,0,0,neutral");
    return lines.join("\n");
  }

  const metrics = [
    { key: "starts", data: comparison.starts },
    { key: "completions", data: comparison.completions },
    { key: "conversion_rate", data: comparison.conversionRate },
    { key: "average_duration", data: comparison.averageDuration },
    { key: "draft_recovery_rate", data: comparison.draftRecoveryRate },
  ];

  metrics.forEach(({ key, data }) => {
    if (data) {
      lines.push(
        `${key},${data.current},${data.previous},${data.delta},${data.deltaPercentage},${data.direction}`
      );
    }
  });

  return lines.join("\n");
}

function convertFailuresToCsv(failures: readonly FailureMetric[]): string {
  const lines = ["reason,count,percentage"];
  (failures || []).forEach((f) => {
    lines.push(`${sanitizeCsvValue(f.reason)},${f.count},${f.percentage}`);
  });
  return lines.join("\n");
}

function convertDraftsToCsv(drafts: DraftMetrics): string {
  const totalDrafts = (drafts.restoredCount || 0) + (drafts.discardedCount || 0);
  const recoveryRate = totalDrafts > 0 ? Math.round((drafts.restoredCount / totalDrafts) * 100) : 0;

  const lines = [
    "metric,value",
    `total_drafts,${totalDrafts}`,
    `recovered,${drafts.restoredCount}`,
    `abandoned,${drafts.discardedCount}`,
    `recovery_rate,${recoveryRate}`,
    `restore_discard_ratio,${drafts.restoreDiscardRatio}`,
    `avg_restore_age_hours,${drafts.avgRestoreAgeHours}`,
    `avg_discard_age_hours,${drafts.avgDiscardAgeHours}`,
  ];
  return lines.join("\n");
}

function convertDiagnosticsToCsv(payload: DiagnosticsExportPayload): string {
  const lines = [
    "metric,value",
    `average_completion_time_ms,${payload.diagnostics.averageCompletionTimeMs}`,
    `average_steps_per_journey,${payload.diagnostics.averageStepsPerJourney}`,
    `stuck_founders_count,${payload.diagnostics.stuckFounders}`,
    `abandonment_rate_percent,${payload.diagnostics.abandonmentRate}`,
    `most_common_drop_off_step,${sanitizeCsvValue(payload.diagnostics.mostCommonDropOffStep || "none")}`,
    `slowest_step,${sanitizeCsvValue(payload.diagnostics.slowestStep || "none")}`,
  ];
  return lines.join("\n");
}

function convertRecoveryToCsv(payload: RecoveryExportPayload): string {
  const r = payload.recovery;
  const lines = [
    "metric,value",
    `recovery_rate_percent,${r.recoveryRate}`,
    `average_recovery_time_ms,${r.averageRecoveryTimeMs}`,
    `recovered_founders,${r.recoveredFounders}`,
    `unrecovered_founders,${r.unrecoveredFounders}`,
    `fastest_recovery_ms,${r.fastestRecoveryMs ?? "N/A"}`,
    `slowest_recovery_ms,${r.slowestRecoveryMs ?? "N/A"}`,
    `recovered_after_failure,${r.cohorts.recoveredAfterFailure}`,
    `recovered_after_abandonment,${r.cohorts.recoveredAfterAbandonment}`,
    `unrecovered_after_failure,${r.cohorts.unrecoveredAfterFailure}`,
    `unrecovered_after_abandonment,${r.cohorts.unrecoveredAfterAbandonment}`,
  ];
  return lines.join("\n");
}

// ─── Provider & Risk Metrics Helpers ─────────────────────────────────

export function buildProviderMetricsFromEvents(
  events: readonly RawOnboardingEventRecord[]
) {
  const providerStarts = new Map<string, number>();
  const providerCompletions = new Map<string, number>();

  for (const ev of events) {
    const provider = extractProvider(ev);
    if (!provider || provider === "all") continue;

    if (ev.event_name === "onboarding_started") {
      providerStarts.set(provider, (providerStarts.get(provider) || 0) + 1);
    } else if (ev.event_name === "onboarding_completed") {
      providerCompletions.set(
        provider,
        (providerCompletions.get(provider) || 0) + 1
      );
    }
  }

  const providers = ["stripe", "razorpay"];
  return providers.map((p) => {
    const starts = providerStarts.get(p) || 0;
    const completions = providerCompletions.get(p) || 0;
    const conversionRate =
      starts > 0 ? Math.round((completions / starts) * 1000) / 10 : 0;
    return {
      provider: p,
      starts,
      completions,
      conversionRate,
    };
  });
}

export function buildRiskSignalsFromJourneys(
  journeys: readonly FounderJourney[]
) {
  const userMap = new Map<
    string,
    { lastActive: number; failures: number; duration: number }
  >();
  const now = Date.now();

  for (const j of journeys) {
    const userId = j.userId || j.sessionId;
    const existing = userMap.get(userId) || {
      lastActive: 0,
      failures: 0,
      duration: 0,
    };

    let lastStepTime = 0;
    if (j.steps && j.steps.length > 0) {
      lastStepTime = new Date(
        j.steps[j.steps.length - 1].timestamp
      ).getTime();
    } else if (j.startedAt) {
      lastStepTime = new Date(j.startedAt).getTime();
    }

    const updatedLastActive = Math.max(existing.lastActive, lastStepTime);
    const updatedFailures =
      j.status === "failed" ? existing.failures + 1 : existing.failures;
    const updatedDuration = Math.max(existing.duration, j.durationMs || 0);

    userMap.set(userId, {
      lastActive: updatedLastActive,
      failures: updatedFailures,
      duration: updatedDuration,
    });
  }

  const activities: UserOnboardingActivity[] = Array.from(
    userMap.entries()
  ).map(([userId, data]) => ({
    userId,
    lastActiveTimestampMs: data.lastActive || now,
    failedSessionCount: data.failures,
    totalOnboardingDurationMs: data.duration,
  }));

  return evaluateAbandonmentRisk(activities, 15 * 60 * 1000, now);
}

function convertRecommendationsToCsv(
  payload: RecommendationsExportPayload
): string {
  const lines: string[] = [];
  lines.push(
    "Kind,ID,Category,Severity,TargetType,TargetID,Title,Impact,Action,Evidence"
  );

  const all = [
    ...payload.warnings.map((w) => ({ ...w, kind: "warning" })),
    ...payload.insights.map((i) => ({ ...i, kind: "insight" })),
  ];

  for (const rec of all) {
    const evidenceStr = rec.evidence ? rec.evidence.join(" | ") : "";
    const row = [
      rec.kind,
      rec.id,
      rec.category,
      rec.severity,
      rec.target?.entityType || "",
      rec.target?.entityId || "",
      `"${(rec.title || "").replace(/"/g, '""')}"`,
      `"${(rec.impact || "").replace(/"/g, '""')}"`,
      `"${(rec.action || "").replace(/"/g, '""')}"`,
      `"${evidenceStr.replace(/"/g, '""')}"`,
    ].join(",");
    lines.push(row);
  }

  return lines.join("\n");
}

export function convertToCsv(type: ExportType, payload: ExportPayload): string {
  if (type === "full") {
    throw new Error("Full exports are available only in JSON format.");
  }
  if (type === "funnel" && "funnel" in payload) {
    return convertFunnelToCsv(payload.funnel);
  }
  if (type === "trends" && "trends" in payload) {
    return convertTrendsToCsv(payload.trends);
  }
  if (type === "comparison" && "comparison" in payload) {
    return convertComparisonToCsv(payload.comparison);
  }
  if (type === "failures" && "failures" in payload) {
    return convertFailuresToCsv(payload.failures);
  }
  if (type === "drafts" && "drafts" in payload) {
    return convertDraftsToCsv(payload.drafts);
  }
  if (type === "diagnostics" && "diagnostics" in payload) {
    return convertDiagnosticsToCsv(payload);
  }
  if (type === "recovery" && "recovery" in payload) {
    return convertRecoveryToCsv(payload as RecoveryExportPayload);
  }
  if (type === "recommendations" && "warnings" in payload) {
    return convertRecommendationsToCsv(payload as RecommendationsExportPayload);
  }

  throw new Error(`Invalid export payload type combination: ${type}`);
}

// ─── Build Response ────────────────────────────────────────────────────

export function buildExportResponse(
  payload: ExportPayload,
  type: ExportType,
  range: TimeRange,
  format: ExportFormat,
  filters?: AnalyticsFilters
): { body: string; headers: Record<string, string> } {
  const filename = generateFileName(type, range, format, filters);

  if (format === "csv") {
    const csvContent = convertToCsv(type, payload);
    return {
      body: csvContent,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Cache": "BYPASS",
      },
    };
  }

  return {
    body: JSON.stringify(payload, null, 2),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Cache": "BYPASS",
    },
  };
}
