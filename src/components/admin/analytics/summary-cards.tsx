import type { FunnelMetrics } from "@/lib/analytics/types";

interface SummaryCardsProps {
  readonly funnel: FunnelMetrics;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function SummaryCards({ funnel }: SummaryCardsProps) {
  const cards = [
    {
      title: "Total Starts",
      value: funnel.totalStarts.toLocaleString(),
      subtitle: "Founders who initiated onboarding",
    },
    {
      title: "Total Completions",
      value: funnel.totalCompletions.toLocaleString(),
      subtitle: "Published startups",
    },
    {
      title: "Conversion Rate",
      value: `${funnel.conversionRate}%`,
      subtitle: "Start-to-submission conversion",
    },
    {
      title: "Avg Completion Duration",
      value: formatDuration(funnel.avgDurationSeconds),
      subtitle: `Median: ${formatDuration(funnel.medianDurationSeconds)}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {card.title}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
          <p className="mt-1 text-xs text-neutral-500">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
