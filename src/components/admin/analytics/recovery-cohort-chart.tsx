"use client";

import type { RecoveryCohortBreakdown } from "@/lib/analytics/recovery-metrics";

interface RecoveryCohortChartProps {
  readonly cohorts: RecoveryCohortBreakdown;
}

function CohortBar({
  label,
  recovered,
  unrecovered,
}: {
  label: string;
  recovered: number;
  unrecovered: number;
}) {
  const total = recovered + unrecovered;
  const recoveredPct = total > 0 ? Math.round((recovered / total) * 100) : 0;
  const unrecoveredPct = total > 0 ? 100 - recoveredPct : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="text-neutral-500">{total} total</span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-md bg-white/5">
        {recoveredPct > 0 && (
          <div
            className="flex items-center justify-center bg-emerald-500/80 text-[10px] font-semibold text-white transition-all duration-300"
            style={{ width: `${recoveredPct}%` }}
            title={`Recovered: ${recovered}`}
          >
            {recoveredPct >= 12 && `${recoveredPct}%`}
          </div>
        )}
        {unrecoveredPct > 0 && (
          <div
            className="flex items-center justify-center bg-rose-500/60 text-[10px] font-semibold text-white transition-all duration-300"
            style={{ width: `${unrecoveredPct}%` }}
            title={`Unrecovered: ${unrecovered}`}
          >
            {unrecoveredPct >= 12 && `${unrecoveredPct}%`}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
          Recovered: {recovered}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500/60" />
          Unrecovered: {unrecovered}
        </span>
      </div>
    </div>
  );
}

export function RecoveryCohortChart({ cohorts }: RecoveryCohortChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-white">Recovery Cohorts</h3>
      <p className="mt-1 text-xs text-neutral-400">
        Breakdown by original failure mode and recovery outcome.
      </p>

      <div className="mt-5 space-y-5">
        <CohortBar
          label="After Failure"
          recovered={cohorts.recoveredAfterFailure}
          unrecovered={cohorts.unrecoveredAfterFailure}
        />
        <CohortBar
          label="After Abandonment"
          recovered={cohorts.recoveredAfterAbandonment}
          unrecovered={cohorts.unrecoveredAfterAbandonment}
        />
      </div>
    </div>
  );
}
