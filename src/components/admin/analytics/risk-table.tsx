"use client";

import React from "react";
import type { RiskSignal } from "@/lib/analytics/risk-scoring";
import { AlertCircle, ShieldAlert, UserCheck } from "lucide-react";

interface RiskTableProps {
  readonly riskSignals: readonly RiskSignal[];
}

export function RiskTable({ riskSignals }: RiskTableProps) {
  if (!riskSignals || riskSignals.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#161616] p-6 text-center text-xs text-neutral-400">
        No founder abandonment risk signals detected for the selected filter range.
      </div>
    );
  }

  const riskBadge = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  const riskIcon = {
    high: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,
    medium: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
    low: <UserCheck className="w-3.5 h-3.5 text-emerald-400" />,
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Founder Abandonment Risk Distribution
          </h3>
          <p className="text-xs text-neutral-400">
            Explainable risk scoring based on inactivity, failed attempts, and onboarding duration
          </p>
        </div>
        <span className="text-xs font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-neutral-300">
          {riskSignals.length} Analyzed
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-neutral-400 uppercase font-mono tracking-wider">
            <tr>
              <th className="px-5 py-3">Founder ID</th>
              <th className="px-5 py-3">Risk Level</th>
              <th className="px-5 py-3">Risk Factor Breakdown</th>
              <th className="px-5 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {riskSignals.map((signal) => {
              const totalPoints = signal.factors.reduce((s, f) => s + f.points, 0);

              return (
                <tr key={signal.userId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-neutral-200 font-medium">
                    {signal.userId}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border capitalize ${
                        riskBadge[signal.risk]
                      }`}
                    >
                      {riskIcon[signal.risk]}
                      {signal.risk}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {signal.factors.length === 0 ? (
                      <span className="text-neutral-500 italic">No risk factors identified</span>
                    ) : (
                      <ul className="space-y-1">
                        {signal.factors.map((factor, idx) => (
                          <li key={idx} className="text-neutral-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{factor.explanation}</span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              (+{factor.points} pt)
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-neutral-300 font-bold">
                    {totalPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
