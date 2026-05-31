"use client";

import React from "react";
import { Fingerprint, ShieldCheck, ShieldAlert, ShieldQuestion, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/isAdmin";
import { formatScore } from "@/lib/formatters";

// ─── Types ──────────────────────────────────────────────────────────────────

import { VerificationStateResult } from "@/lib/verification-state";

interface RevenueConsistencyCardProps {
  consistency: VerificationStateResult | null | undefined;
  ownerId?: string;
  isDemo?: boolean;
}

// ─── Level Config ───────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  "Verified Patterns": {
    icon: ShieldCheck,
    gradient: "from-emerald-500/20 to-emerald-900/5",
    border: "border-emerald-500/20",
    textColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    barColor: "bg-emerald-500",
    barGlow: "shadow-emerald-500/40",
    description: "Revenue patterns appear consistent and verified",
  },
  Refining: {
    icon: ShieldQuestion,
    gradient: "from-amber-500/20 to-amber-900/5",
    border: "border-amber-500/20",
    textColor: "text-amber-400",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-300",
    barColor: "bg-amber-500",
    barGlow: "shadow-amber-500/40",
    description: "Revenue patterns building confidence",
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

export const RevenueConsistencyCard: React.FC<RevenueConsistencyCardProps> = ({ consistency, ownerId, isDemo = false }) => {
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = React.useState(false);

  React.useEffect(() => {
    const checkOwner = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const isOwner = data.user.id === ownerId;
        const admin = isAdmin(data.user.email);
        setIsOwnerOrAdmin(!!(isOwner || admin));
      }
    };
    if (ownerId) {
      checkOwner();
    }
  }, [ownerId]);

  if (!consistency || consistency.confidenceTier === "SELF_REPORTED") {
    return (
      <div className="p-6 bg-neutral-900/20 border border-white/5 rounded-[2rem] flex items-center gap-4 relative overflow-hidden">
        <div className="p-3 bg-neutral-800/50 rounded-2xl">
          <Fingerprint className="w-5 h-5 text-neutral-600 animate-pulse" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
            Revenue Consistency
          </p>
          <p className="text-sm text-neutral-400 font-bold mt-1">Awaiting Verification Data</p>
        </div>
      </div>
    );
  }

  const { consistencyScore: score, consistencyLevel, consistencyFlags: flags } = consistency;
  
  const level =
    consistencyLevel === "Consistent" && consistency.hasVerificationEvidence
      ? "Verified Patterns"
      : "Refining";
  
  const config =
    LEVEL_CONFIG[level as "Refining" | "Verified Patterns"] ||
    LEVEL_CONFIG["Refining"];
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
              Revenue Consistency
            </p>
            <p className={`text-[10px] font-medium ${config.textColor} opacity-70 mt-0.5`}>
              {config.description}
            </p>
          </div>
        </div>

        {/* Level Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.badgeBg}`}>
          <LevelIcon className={`w-3.5 h-3.5 ${config.badgeText} translate-y-[-0.5px]`} />
          <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${config.badgeText}`}>
            {level}
          </span>
        </div>
      </div>

      {/* Score Display (Owner-only) */}
      {isOwnerOrAdmin ? (
        <div className="flex items-end gap-4 mb-5 relative z-10">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white tabular-nums tracking-tight">
              {formatScore(score, 0)}
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
                Refining
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-700">
                {isDemo ? "Simulated Patterns" : "Verified Patterns"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 mb-5 p-4 bg-white/[0.02] border border-white/[0.04] rounded-2xl relative z-10">
          <div className="flex items-start gap-3">
            {isDemo ? (
              <Info className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            )}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                {isDemo ? "Illustrative Sandbox Data" : "Consistent Billing History"}
              </h4>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                {isDemo
                  ? "This startup profile is a sandbox demonstration containing simulated metrics. No real verification of billing accounts has been conducted."
                  : "Verification algorithms analyze transaction diversity, pattern spacing, and recurring intervals to confirm organic, non-synthetic revenue."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Flags (Owner-only) */}
      {isOwnerOrAdmin && flags.length > 0 && (
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
