"use client";

import type { StepDuration } from "@/lib/analytics/diagnostics";

interface StepDurationTableProps {
  readonly slowSteps: readonly StepDuration[];
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round((sec / 60) * 10) / 10;
  if (min < 60) return `${min} min`;
  const hr = Math.round((min / 60) * 10) / 10;
  return `${hr} hours`;
}

export function StepDurationTable({ slowSteps }: StepDurationTableProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-base font-bold text-white">Step Duration & Slow Transitions</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Normalized average duration between consecutive onboarding steps (idle outliers &gt; 2h excluded).
        </p>
      </div>

      {slowSteps.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500">
          No step transitions recorded for completed journeys in this window.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-semibold">
                <th className="pb-3 pr-4">From Step</th>
                <th className="pb-3 pr-4">To Step</th>
                <th className="pb-3 text-right">Normalized Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {slowSteps.map((item) => (
                <tr key={`${item.from}-${item.to}`} className="hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-white">{item.from}</td>
                  <td className="py-3 pr-4 font-medium text-neutral-300">{item.to}</td>
                  <td className="py-3 text-right font-mono text-amber-400 font-semibold">
                    {formatMs(item.averageMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
