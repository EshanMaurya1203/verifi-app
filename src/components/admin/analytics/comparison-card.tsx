import type { ComparisonMetric } from "@/lib/analytics/comparison";

interface ComparisonCardProps {
  readonly title: string;
  readonly metric: ComparisonMetric;
  readonly isRate?: boolean;
  readonly isDuration?: boolean;
}

function formatValue(value: number, isRate?: boolean, isDuration?: boolean): string {
  if (isDuration) {
    if (value <= 0) return "0s";
    const mins = Math.floor(value / 60);
    const secs = Math.round(value % 60);
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }
  if (isRate) {
    return `${value}%`;
  }
  return value.toLocaleString();
}

export function ComparisonCard({
  title,
  metric,
  isRate = false,
  isDuration = false,
}: ComparisonCardProps) {
  const { current, previous, deltaPercentage, direction } = metric;

  const isUp = direction === "up";
  const isDown = direction === "down";

  // Color classes
  const badgeColorClass = isUp
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    : isDown
      ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
      : "border-neutral-500/20 bg-neutral-500/10 text-neutral-400";

  const arrowSymbol = isUp ? "↑" : isDown ? "↓" : "→";
  const directionText = isUp ? "Up" : isDown ? "Down" : "Neutral";
  const signSymbol = deltaPercentage > 0 ? "+" : "";

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm flex flex-col justify-between">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          {title}
        </span>

        {/* Badge with direction and % change */}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xl font-bold text-white">
            {formatValue(current, isRate, isDuration)}
          </div>
          <span
            className={`inline-flex items-center space-x-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeColorClass}`}
          >
            <span>{arrowSymbol}</span>
            <span>{signSymbol}{deltaPercentage}%</span>
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-xs text-neutral-400 space-y-1">
        <div className="flex justify-between">
          <span>Current:</span>
          <span className="font-semibold text-white">
            {formatValue(current, isRate, isDuration)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Previous:</span>
          <span className="font-medium text-neutral-400">
            {formatValue(previous, isRate, isDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
