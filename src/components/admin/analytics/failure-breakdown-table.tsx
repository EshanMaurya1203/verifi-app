import type { FailureMetric } from "@/lib/analytics/types";

interface FailureBreakdownTableProps {
  readonly failures: readonly FailureMetric[];
}

export function FailureBreakdownTable({ failures }: FailureBreakdownTableProps) {
  // Data is guaranteed to be sorted by occurrences descending from backend,
  // but we enforce it here read-only as well.
  const sortedFailures = [...failures].sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-6 shadow-sm">
      <h3 className="text-base font-bold text-white">Submission Failures</h3>
      <p className="mt-1 text-xs text-neutral-400">
        Breakdown of onboarding submission failure reasons and occurrences.
      </p>

      {sortedFailures.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm font-medium text-neutral-400">No submission failures recorded</p>
          <p className="mt-1 text-xs text-neutral-500">All onboarding attempts completed cleanly in this time range.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase text-neutral-400">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Failure Reason
                </th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">
                  Occurrences
                </th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedFailures.map((item) => (
                <tr key={item.reason} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3.5 px-4 font-medium text-white font-mono text-xs">
                    {item.reason}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-white">
                    {item.count.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-neutral-400">
                    {item.percentage}%
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
