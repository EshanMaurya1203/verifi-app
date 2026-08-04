"use client";

import type { DiagnosticsReport } from "@/lib/analytics/diagnostics";

interface DiagnosticsCardsProps {
  readonly report: DiagnosticsReport;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "N/A";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

export function DiagnosticsCards({ report }: DiagnosticsCardsProps) {
  const cards = [
    {
      title: "Avg Completion Time",
      value: formatDuration(report.averageCompletionTimeMs),
      subtitle: "From start to submission",
    },
    {
      title: "Avg Steps / Journey",
      value: `${report.averageStepsPerJourney}`,
      subtitle: "Events logged per session",
    },
    {
      title: "Stuck Founders",
      value: `${report.stuckFounders}`,
      subtitle: "In-progress > 24 hours",
    },
    {
      title: "Abandonment Rate",
      value: `${report.abandonmentRate}%`,
      subtitle: "Sessions discarded",
    },
    {
      title: "Top Drop-off Step",
      value: report.mostCommonDropOffStep || "None",
      subtitle: "Most frequent abandonment point",
    },
    {
      title: "Slowest Transition",
      value: report.slowestStep || "None",
      subtitle: "Longest average step duration",
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
