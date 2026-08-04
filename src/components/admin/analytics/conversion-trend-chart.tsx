import type { RateTrendPoint } from "@/lib/analytics/trends";
import { RateTrendLineChart } from "./trend-chart-shared";

interface ConversionTrendChartProps {
  readonly data: readonly RateTrendPoint[];
}

export function ConversionTrendChart({ data }: ConversionTrendChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <h4 className="text-sm font-bold text-white">Conversion Rate Trend</h4>
      <p className="mt-0.5 text-[11px] text-neutral-400">Daily start-to-completion conversion %</p>

      {data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center">
          <p className="text-xs text-neutral-500">No conversion data for this range</p>
        </div>
      ) : (
        <div className="mt-4">
          <RateTrendLineChart data={data} color="#f59e0b" />
        </div>
      )}
    </div>
  );
}
