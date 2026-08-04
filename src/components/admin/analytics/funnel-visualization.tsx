import type { FunnelMetrics } from "@/lib/analytics/types";

interface FunnelVisualizationProps {
  readonly funnel: FunnelMetrics;
}

const DISPLAY_STAGES = [
  "start",
  "step_1",
  "step_2",
  "submission",
] as const;

const STAGE_LABELS: Record<typeof DISPLAY_STAGES[number], string> = {
  start: "Started",
  step_1: "Connected Provider",
  step_2: "Verified Revenue",
  submission: "Published Startup",
};

export function FunnelVisualization({ funnel }: FunnelVisualizationProps) {
  // Map funnel stages strictly from DISPLAY_STAGES configuration array
  const stageMap = new Map(funnel.stages.map((s) => [s.stage, s]));

  const displayStages = DISPLAY_STAGES.map((stageKey) => {
    const found = stageMap.get(stageKey);
    return {
      stageKey,
      label: STAGE_LABELS[stageKey],
      count: found?.count ?? 0,
      retentionRate: found?.retentionRate ?? 0,
      dropOffRate: found?.dropOffRate ?? 0,
    };
  });

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-6 shadow-sm">
      <h3 className="text-base font-bold text-white">Onboarding Funnel</h3>
      <p className="mt-1 text-xs text-neutral-400">
        Conversion & drop-off progression across onboarding stages.
      </p>

      {/* Desktop Layout: Horizontal Grid */}
      <div className="mt-6 hidden md:grid md:grid-cols-4 md:gap-4">
        {displayStages.map((item, index) => {
          const isLast = index === displayStages.length - 1;

          return (
            <div
              key={item.stageKey}
              className="relative flex flex-col justify-between rounded-lg border border-white/5 bg-white/[0.02] p-4"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Stage 0{index + 1}
                </span>
                <h4 className="mt-1 text-sm font-semibold text-white">{item.label}</h4>
                <p className="mt-3 text-2xl font-bold text-white">
                  {item.count.toLocaleString()}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 text-xs text-neutral-400 space-y-1">
                <div className="flex justify-between">
                  <span>Retention:</span>
                  <span className="font-medium text-emerald-400">{item.retentionRate}%</span>
                </div>
                {!isLast && (
                  <div className="flex justify-between">
                    <span>Drop-off:</span>
                    <span className="font-medium text-rose-400">{item.dropOffRate}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Layout: Vertical Stack */}
      <div className="mt-6 flex flex-col space-y-3 md:hidden">
        {displayStages.map((item, index) => {
          const isLast = index === displayStages.length - 1;

          return (
            <div key={item.stageKey} className="flex flex-col">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Stage 0{index + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-white">{item.label}</h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Retention: <span className="text-emerald-400 font-medium">{item.retentionRate}%</span>
                    {!isLast && (
                      <> • Drop-off: <span className="text-rose-400 font-medium">{item.dropOffRate}%</span></>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white">{item.count.toLocaleString()}</span>
                </div>
              </div>

              {!isLast && (
                <div className="flex justify-center my-1 text-neutral-600">
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
