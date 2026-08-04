import type { TrendPoint } from "@/lib/analytics/trends";
import { TrendLineChart } from "./trend-chart-shared";

interface StartsTrendChartProps {
  readonly data: readonly TrendPoint[];
}

export function StartsTrendChart({ data }: StartsTrendChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <h4 className="text-sm font-bold text-white">Starts Over Time</h4>
      <p className="mt-0.5 text-[11px] text-neutral-400">Daily onboarding initiations</p>

      {data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center">
          <p className="text-xs text-neutral-500">No starts data for this range</p>
        </div>
      ) : (
        <div className="mt-4">
          <TrendLineChart data={data} color="#3b82f6" />
        </div>
      )}
    </div>
  );
}
