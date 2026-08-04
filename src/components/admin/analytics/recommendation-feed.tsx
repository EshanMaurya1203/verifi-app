"use client";

import React, { useState } from "react";
import type { Recommendation } from "@/lib/analytics/recommendations";
import { RecommendationCard } from "./recommendation-cards";
import { AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";

interface RecommendationFeedProps {
  readonly warnings: readonly Recommendation[];
  readonly insights: readonly Recommendation[];
}

export function RecommendationFeed({ warnings, insights }: RecommendationFeedProps) {
  const [activeTab, setActiveTab] = useState<"all" | "warnings" | "insights">("all");

  const showWarnings = activeTab === "all" || activeTab === "warnings";
  const showInsights = activeTab === "all" || activeTab === "insights";

  const totalWarnings = warnings ? warnings.length : 0;
  const totalInsights = insights ? insights.length : 0;

  return (
    <div className="space-y-6">
      {/* Header controls & tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Founder Recommendation Intelligence
          </h2>
          <p className="text-xs text-neutral-400">
            Deterministic rule-based recommendations for improving onboarding conversion
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-[#161616] p-1 rounded-lg border border-white/10 text-xs font-medium">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "all"
                ? "bg-white/10 text-white font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All ({totalWarnings + totalInsights})
          </button>
          <button
            onClick={() => setActiveTab("warnings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "warnings"
                ? "bg-amber-500/20 text-amber-300 font-semibold"
                : "text-neutral-400 hover:text-amber-400"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Warnings ({totalWarnings})
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "insights"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                : "text-neutral-400 hover:text-emerald-400"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Insights ({totalInsights})
          </button>
        </div>
      </div>

      {/* Warnings Section */}
      {showWarnings && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Actionable Warnings ({totalWarnings} / max 10)</span>
          </div>

          {totalWarnings === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#161616] p-6 text-center text-xs text-neutral-400">
              No active onboarding warnings detected. Funnel metrics are operating within health thresholds.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {warnings.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insights Section */}
      {showInsights && (
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <Lightbulb className="w-4 h-4" />
            <span>Positive Insights ({totalInsights} / max 3)</span>
          </div>

          {totalInsights === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#161616] p-6 text-center text-xs text-neutral-400">
              No positive insights recorded for this time range.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {insights.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
