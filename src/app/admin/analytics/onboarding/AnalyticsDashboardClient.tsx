"use client";

import { useState } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import { DEFAULT_FILTERS, type AnalyticsFilters } from "@/lib/analytics/filters";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics";
import { useOnboardingTrends } from "@/hooks/useOnboardingTrends";
import { useOnboardingComparison } from "@/hooks/useOnboardingComparison";
import { useOnboardingDiagnostics } from "@/hooks/useOnboardingDiagnostics";
import { useOnboardingRecovery } from "@/hooks/useOnboardingRecovery";
import { SummaryCards } from "@/components/admin/analytics/summary-cards";
import { FunnelVisualization } from "@/components/admin/analytics/funnel-visualization";
import { FailureBreakdownTable } from "@/components/admin/analytics/failure-breakdown-table";
import { DraftRecoveryMetrics } from "@/components/admin/analytics/draft-recovery-metrics";
import { StartsTrendChart } from "@/components/admin/analytics/starts-trend-chart";
import { CompletionsTrendChart } from "@/components/admin/analytics/completions-trend-chart";
import { ConversionTrendChart } from "@/components/admin/analytics/conversion-trend-chart";
import { DraftRecoveryTrendChart } from "@/components/admin/analytics/draft-recovery-trend-chart";
import { ComparisonSection } from "@/components/admin/analytics/comparison-section";
import { DiagnosticsCards } from "@/components/admin/analytics/diagnostics-cards";
import { DropOffTable } from "@/components/admin/analytics/dropoff-table";
import { StepDurationTable } from "@/components/admin/analytics/step-duration-table";
import { StuckFoundersTable } from "@/components/admin/analytics/stuck-founders-table";
import { ExportMenu } from "@/components/admin/analytics/export-menu";
import { FilterBar } from "@/components/admin/analytics/filter-bar";
import { RecoveryCards } from "@/components/admin/analytics/recovery-cards";
import { RecoveryCohortChart } from "@/components/admin/analytics/recovery-cohort-chart";
import { RecoveryTable } from "@/components/admin/analytics/recovery-table";
import { AnalyticsLoading } from "@/components/admin/analytics/analytics-loading";
import { AnalyticsError } from "@/components/admin/analytics/analytics-error";
import { AnalyticsEmpty } from "@/components/admin/analytics/analytics-empty";

export function AnalyticsDashboardClient() {
  const [range, setRange] = useState<TimeRange>("7d");
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  const { report, isLoading, isError, isRefetching, retry } = useOnboardingAnalytics(range, filters);
  const { trends, isLoading: trendsLoading } = useOnboardingTrends(range, filters);
  const { comparison } = useOnboardingComparison(range, filters);
  const { data: diagnosticsData, isLoading: diagnosticsLoading } = useOnboardingDiagnostics(range, filters);
  const { data: recoveryData, isLoading: recoveryLoading } = useOnboardingRecovery(range, filters);

  const isEmpty = report ? report.funnel.totalStarts === 0 : false;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header, Export Menu & Filter Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
              Onboarding Analytics
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Monitor onboarding performance, bottlenecks, and founder journey diagnostics.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ExportMenu range={range} filters={filters} />
            <FilterBar
              range={range}
              filters={filters}
              onRangeChange={setRange}
              onFiltersChange={setFilters}
              disabled={isLoading || isRefetching}
            />
          </div>
        </div>

        {/* Content States */}
        {isLoading && <AnalyticsLoading />}

        {isError && !isLoading && (
          <AnalyticsError onRetry={retry} isRetrying={isRefetching} />
        )}

        {!isLoading && !isError && isEmpty && <AnalyticsEmpty />}

        {!isLoading && !isError && !isEmpty && report && (
          <div
            aria-busy={isRefetching}
            className={`space-y-8 transition-opacity duration-150 ${
              isRefetching ? "opacity-60" : "opacity-100"
            }`}
          >
            {/* 1. Summary Cards */}
            <SummaryCards funnel={report.funnel} />

            {/* 2. Period Comparison Section */}
            {comparison && <ComparisonSection comparison={comparison} />}

            {/* 3. Funnel Visualization */}
            <FunnelVisualization funnel={report.funnel} />

            {/* 4. Diagnostics Cards */}
            {!diagnosticsLoading && diagnosticsData && (
              <DiagnosticsCards report={diagnosticsData.diagnostics} />
            )}

            {/* 5. Recovery Cards */}
            {!recoveryLoading && recoveryData && (
              <>
                <div className="border-t border-white/10 pt-8">
                  <h2 className="text-lg font-bold text-white">Founder Recovery Intelligence</h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    Track founders who recovered after failed or abandoned onboarding.
                  </p>
                </div>
                <RecoveryCards report={recoveryData.recovery} />
              </>
            )}

            {/* 6. Recovery Cohort Chart */}
            {!recoveryLoading && recoveryData && (
              <RecoveryCohortChart cohorts={recoveryData.recovery.cohorts} />
            )}

            {/* 7. Drop-off Table */}
            {!diagnosticsLoading && diagnosticsData && (
              <DropOffTable dropOffs={diagnosticsData.dropOffs} />
            )}

            {/* 8. Step Duration Table */}
            {!diagnosticsLoading && diagnosticsData && (
              <StepDurationTable slowSteps={diagnosticsData.slowSteps} />
            )}

            {/* 9. Trend Charts Section */}
            {!trendsLoading && trends && (
              <>
                <div className="border-t border-white/10 pt-8">
                  <h2 className="text-lg font-bold text-white">Trends Over Time</h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    {trends.summary.granularity === "hourly"
                      ? "Hourly"
                      : trends.summary.granularity === "monthly"
                        ? "Monthly"
                        : "Daily"}{" "}
                    breakdowns of onboarding activity and conversion.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <StartsTrendChart data={trends.trends.starts} />
                  <CompletionsTrendChart data={trends.trends.completions} />
                  <ConversionTrendChart data={trends.trends.conversion} />
                  <DraftRecoveryTrendChart data={trends.trends.draftRecovery} />
                </div>
              </>
            )}

            {/* Trend Charts Loading Skeleton */}
            {trendsLoading && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-[#161616] p-5 h-52">
                    <div className="h-4 w-36 rounded bg-white/10" />
                    <div className="mt-1 h-3 w-48 rounded bg-white/5" />
                    <div className="mt-6 h-32 w-full rounded bg-white/[0.03]" />
                  </div>
                ))}
              </div>
            )}

            {/* 10. Stuck Founders Table */}
            {!diagnosticsLoading && diagnosticsData && (
              <StuckFoundersTable stuckFounders={diagnosticsData.stuckFounders} />
            )}

            {/* 11. Recovery Session Table */}
            {!recoveryLoading && recoveryData && (
              <RecoveryTable
                recovered={recoveryData.recovered}
                unrecovered={recoveryData.unrecovered}
              />
            )}

            {/* 12. Failure Breakdown & Draft Recovery */}
            <FailureBreakdownTable failures={report.failures} />
            <DraftRecoveryMetrics drafts={report.drafts} />
          </div>
        )}
      </div>
    </div>
  );
}
