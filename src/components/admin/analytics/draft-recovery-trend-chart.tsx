import type { RateTrendPoint } from "@/lib/analytics/trends";
import { RateTrendLineChart } from "./trend-chart-shared";

interface DraftRecoveryTrendChartProps {
  readonly data: readonly RateTrendPoint[];
}

export function DraftRecoveryTrendChart({ data }: DraftRecoveryTrendChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <h4 className="text-sm font-bold text-white">Draft Recovery Trend</h4>
      <p className="mt-0.5 text-[11px] text-neutral-400">Daily draft recovery rate %</p>

      {data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center">
          <p className="text-xs text-neutral-500">No draft recovery data for this range</p>
        </div>
      ) : (
        <div className="mt-4">
          <RateTrendLineChart data={data} color="#8b5cf6" />
        </div>
      )}
    </div>
  );
}
