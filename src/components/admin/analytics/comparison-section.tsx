import type { ComparisonReport } from "@/lib/analytics/comparison";
import { ComparisonCard } from "./comparison-card";

interface ComparisonSectionProps {
  readonly comparison: ComparisonReport;
}

export function ComparisonSection({ comparison }: ComparisonSectionProps) {
  if (!comparison.summary.comparisonEnabled || !comparison.metrics) {
    return (
      <div className="border-t border-white/10 pt-8 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Period Comparison</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Compare performance metrics against the prior equivalent timeframe.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#161616] p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-400">
            Period comparison unavailable for all-time analytics.
          </p>
        </div>
      </div>
    );
  }

  const { metrics } = comparison;

  return (
    <div className="border-t border-white/10 pt-8 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Period Comparison</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Comparing current {comparison.summary.range} metrics against the prior {comparison.summary.range} period.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ComparisonCard
          title="Total Starts"
          metric={metrics.starts}
        />
        <ComparisonCard
          title="Total Completions"
          metric={metrics.completions}
        />
        <ComparisonCard
          title="Conversion Rate"
          metric={metrics.conversionRate}
          isRate
        />
        <ComparisonCard
          title="Average Duration"
          metric={metrics.averageDuration}
          isDuration
        />
        <ComparisonCard
          title="Draft Recovery Rate"
          metric={metrics.draftRecoveryRate}
          isRate
        />
      </div>
    </div>
  );
}
