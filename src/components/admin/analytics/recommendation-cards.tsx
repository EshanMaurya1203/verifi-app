"use client";

import React from "react";
import type { Recommendation } from "@/lib/analytics/recommendations";
import { AlertTriangle, Lightbulb, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react";

interface RecommendationCardProps {
  readonly recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const isWarning = recommendation.kind === "warning";

  const severityColors = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  const severityIcon = {
    critical: <ShieldAlert className="w-4 h-4 text-red-400" />,
    high: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    medium: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    low: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#161616] p-5 shadow-sm transition-all hover:border-white/20 flex flex-col gap-4">
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isWarning ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" /> Warning
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lightbulb className="w-3.5 h-3.5" /> Positive Insight
            </span>
          )}
          <span className="text-xs text-neutral-400 capitalize font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
            {recommendation.category}
          </span>
        </div>
        <span
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${
            severityColors[recommendation.severity]
          }`}
        >
          {severityIcon[recommendation.severity]}
          {recommendation.severity}
        </span>
      </div>

      {/* Content Title & Description */}
      <div>
        <h3 className="text-base font-semibold text-white tracking-tight">
          {recommendation.title}
        </h3>
        <p className="mt-1 text-sm text-neutral-300 leading-relaxed">
          {recommendation.description}
        </p>
      </div>

      {/* Impact */}
      {recommendation.impact && (
        <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-xs text-neutral-400">
          <span className="font-semibold text-neutral-200">Impact: </span>
          {recommendation.impact}
        </div>
      )}

      {/* Evidence list */}
      {recommendation.evidence && recommendation.evidence.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Evidence Signals ({recommendation.evidence.length})
          </p>
          <ul className="space-y-1 pl-3 border-l border-white/10">
            {recommendation.evidence.map((point, idx) => (
              <li key={idx} className="text-xs text-neutral-300 font-mono">
                • {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Action */}
      <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
          <ArrowRight className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{recommendation.action}</span>
        </div>
      </div>
    </div>
  );
}
