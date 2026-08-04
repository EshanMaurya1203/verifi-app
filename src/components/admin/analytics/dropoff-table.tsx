"use client";

import type { DropOffPoint } from "@/lib/analytics/diagnostics";

interface DropOffTableProps {
  readonly dropOffs: readonly DropOffPoint[];
}

export function DropOffTable({ dropOffs }: DropOffTableProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm">
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-base font-bold text-white">Drop-off Points Analysis</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Last event reached by founders prior to abandoning onboarding.
        </p>
      </div>

      {dropOffs.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500">
          No abandonment drop-offs recorded for the selected window.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-semibold">
                <th className="pb-3 pr-4">Final Step Reached</th>
                <th className="pb-3 text-right">Abandonment Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dropOffs.map((item) => (
                <tr key={item.step} className="hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-white">{item.step}</td>
                  <td className="py-3 text-right font-mono text-rose-400 font-semibold">
                    {item.count}
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
