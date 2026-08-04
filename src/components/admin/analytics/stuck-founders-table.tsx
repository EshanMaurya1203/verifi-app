"use client";

import type { FounderJourney } from "@/lib/analytics/journey";

interface StuckFoundersTableProps {
  readonly stuckFounders: readonly FounderJourney[];
}

function formatAgeHours(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const hours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} days ago`;
}

export function StuckFoundersTable({ stuckFounders }: StuckFoundersTableProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-base font-bold text-white">Stuck Founders Detection</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Founders in an active onboarding session with zero activity in over 24 hours.
        </p>
      </div>

      {stuckFounders.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500">
          No stuck founders detected for the selected filter criteria.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-semibold">
                <th className="pb-3 pr-4">User ID</th>
                <th className="pb-3 pr-4">Session ID</th>
                <th className="pb-3 pr-4">Last Step Reached</th>
                <th className="pb-3 pr-4">Total Steps</th>
                <th className="pb-3 text-right">Inactivity Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stuckFounders.map((j) => {
                const lastStep = j.steps && j.steps.length > 0 ? j.steps[j.steps.length - 1] : null;
                return (
                  <tr key={j.sessionId} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-mono font-medium text-white truncate max-w-[140px]">
                      {j.userId}
                    </td>
                    <td className="py-3 pr-4 font-mono text-neutral-400 truncate max-w-[140px]">
                      {j.sessionId}
                    </td>
                    <td className="py-3 pr-4 text-neutral-300 font-medium">
                      {lastStep ? lastStep.event : "onboarding_started"}
                    </td>
                    <td className="py-3 pr-4 text-neutral-400">{j.steps.length}</td>
                    <td className="py-3 text-right font-mono text-rose-400 font-semibold">
                      {lastStep ? formatAgeHours(lastStep.timestamp) : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
