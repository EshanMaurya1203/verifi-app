import type { DraftMetrics } from "@/lib/analytics/types";

interface DraftRecoveryMetricsProps {
  readonly drafts: DraftMetrics;
}

export function DraftRecoveryMetrics({ drafts }: DraftRecoveryMetricsProps) {
  const totalDrafts = drafts.restoredCount + drafts.discardedCount;
  const recoveryRate = totalDrafts > 0
    ? Math.round((drafts.restoredCount / totalDrafts) * 100)
    : 0;

  const cards = [
    {
      title: "Total Draft Events",
      value: totalDrafts.toLocaleString(),
      subtitle: "Draft interactions recorded",
    },
    {
      title: "Recovered Drafts",
      value: drafts.restoredCount.toLocaleString(),
      subtitle: drafts.avgRestoreAgeHours > 0 ? `Avg age: ${drafts.avgRestoreAgeHours}h` : "Drafts restored by founders",
    },
    {
      title: "Abandoned / Discarded",
      value: drafts.discardedCount.toLocaleString(),
      subtitle: drafts.avgDiscardAgeHours > 0 ? `Avg age: ${drafts.avgDiscardAgeHours}h` : "Drafts explicitly discarded",
    },
    {
      title: "Recovery Rate",
      value: `${recoveryRate}%`,
      subtitle: `Restore/Discard ratio: ${drafts.restoreDiscardRatio}`,
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-6 shadow-sm">
      <h3 className="text-base font-bold text-white">Draft Recovery & Lifecycle</h3>
      <p className="mt-1 text-xs text-neutral-400">
        Metrics on saved progress, draft restoration, and abandonment.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {card.title}
            </p>
            <p className="mt-2 text-xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-neutral-400">{card.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
