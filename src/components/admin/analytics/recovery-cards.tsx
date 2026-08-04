"use client";

import type { RecoveryReport } from "@/lib/analytics/recovery-metrics";

interface RecoveryCardsProps {
  readonly report: RecoveryReport;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "N/A";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

export function RecoveryCards({ report }: RecoveryCardsProps) {
  const cards = [
    {
      title: "Recovery Rate",
      value: `${report.recoveryRate}%`,
      subtitle: "At-risk founders who later completed",
    },
    {
      title: "Avg Recovery Time",
      value: formatDuration(report.averageRecoveryTimeMs),
      subtitle: "Mean time to successful retry",
    },
    {
      title: "Recovered",
      value: `${report.recoveredFounders}`,
      subtitle: "Founders who returned and completed",
    },
    {
      title: "Unrecovered",
      value: `${report.unrecoveredFounders}`,
      subtitle: "Founders who never completed",
    },
    {
      title: "Fastest Recovery",
      value: formatDuration(report.fastestRecoveryMs ?? 0),
      subtitle: "Shortest time to successful retry",
    },
    {
      title: "Slowest Recovery",
      value: formatDuration(report.slowestRecoveryMs ?? 0),
      subtitle: "Longest time to successful retry",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm transition-colors hover:border-white/20"
        >
          <p className="text-xs font-medium text-neutral-400">{card.title}</p>
          <p className="mt-2 text-2xl font-bold text-white tracking-tight truncate">
            {card.value}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
