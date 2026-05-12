"use client";

import React from "react";
import { Fingerprint, ShieldCheck, ShieldAlert, ShieldQuestion, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

import { VerificationStateResult } from "@/lib/verification-state";

interface RevenueAuthenticityCardProps {
  authenticity: VerificationStateResult | null | undefined;
}

// ─── Level Config ───────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  Organic: {
    icon: ShieldCheck,
    gradient: "from-emerald-500/20 to-emerald-900/5",
    border: "border-emerald-500/20",
    textColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    barColor: "bg-emerald-500",
    barGlow: "shadow-emerald-500/40",
    description: "Revenue patterns appear natural and legitimate",
  },
  Moderate: {
    icon: ShieldQuestion,
    gradient: "from-amber-500/20 to-amber-900/5",
    border: "border-amber-500/20",
    textColor: "text-amber-400",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-300",
    barColor: "bg-amber-500",
    barGlow: "shadow-amber-500/40",
    description: "Some patterns need further verification",
  },
  Suspicious: {
    icon: ShieldAlert,
    gradient: "from-red-500/20 to-red-900/5",
    border: "border-red-500/20",
    textColor: "text-red-400",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-300",
    barColor: "bg-red-500",
    barGlow: "shadow-red-500/40",
    description: "Revenue patterns show signs of manipulation",
  },
} as const;

// ─── Flag Classification ────────────────────────────────────────────────────

function classifyFlag(flag: string): "positive" | "warning" | "info" {
  const positiveKeywords = ["verified", "organic", "healthy", "consistent", "natural", "growth", "diversity"];
  const warningKeywords = ["suspicious", "burst", "identical", "low", "near-zero", "uniform", "detected"];

  const lower = flag.toLowerCase();
  if (positiveKeywords.some((kw) => lower.includes(kw))) return "positive";
  if (warningKeywords.some((kw) => lower.includes(kw))) return "warning";
  return "info";
}

const FLAG_ICONS = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

const FLAG_COLORS = {
  positive: "text-emerald-400/90",
  warning: "text-amber-400/90",
  info: "text-neutral-400/90",
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export const RevenueAuthenticityCard: React.FC<RevenueAuthenticityCardProps> = ({ authenticity }) => {
  if (!authenticity) {
    return (
      <div className="p-6 bg-neutral-900/20 border border-white/5 rounded-[2rem] flex items-center gap-4">
        <div className="p-3 bg-neutral-800/50 rounded-2xl">
          <Fingerprint className="w-5 h-5 text-neutral-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
            Revenue Authenticity
          </p>
          <p className="text-sm text-neutral-500 mt-0.5">Awaiting event data…</p>
        </div>
      </div>
    );
  }

  const { authenticityScore: score, authenticityLevel, authenticityFlags: flags } = authenticity;
  
  // Safe cast since the components only know about these 3 levels
  const level = authenticityLevel as "Suspicious" | "Moderate" | "Organic";
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG["Moderate"];
  const LevelIcon = config.icon;

  return (
    <div
      className={`
        relative overflow-hidden
        p-6 rounded-[2rem]
        bg-gradient-to-br ${config.gradient}
        border ${config.border}
        transition-all duration-500
      `}
    >
      {/* Background glow effect */}
      <div
        className={`
          absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-[0.07]
          ${config.barColor} blur-3xl pointer-events-none
        `}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-neutral-900/60 rounded-xl backdrop-blur-sm">
            <Fingerprint className={`w-4 h-4 ${config.textColor}`} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">
              Revenue Authenticity
            </p>
            <p className={`text-[10px] font-medium ${config.textColor} opacity-70 mt-0.5`}>
              {config.description}
            </p>
          </div>
        </div>

        {/* Level Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.badgeBg}`}>
          <LevelIcon className={`w-3 h-3 ${config.badgeText}`} />
          <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${config.badgeText}`}>
            {level}
          </span>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-end gap-4 mb-5 relative z-10">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-white tabular-nums tracking-tight">
            {score}
          </span>
          <span className="text-sm font-bold text-neutral-500">/100</span>
        </div>

        {/* Score bar */}
        <div className="flex-1 mb-2">
          <div className="h-1.5 bg-neutral-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${config.barColor} shadow-lg ${config.barGlow} transition-all duration-1000 ease-out`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-700">
              Suspicious
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-700">
              Organic
            </span>
          </div>
        </div>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="space-y-2 relative z-10">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-3">
            Analysis Signals
          </p>
          {flags.map((flag, idx) => {
            const type = classifyFlag(flag);
            const FlagIcon = FLAG_ICONS[type];
            const flagColor = FLAG_COLORS[type];

            return (
              <div
                key={idx}
                className="flex items-start gap-2.5 group"
              >
                <FlagIcon
                  className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${flagColor} transition-transform duration-200 group-hover:scale-110`}
                />
                <span className="text-[11px] font-semibold text-neutral-400 leading-relaxed">
                  {flag}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
