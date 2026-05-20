"use client";

import React from "react";
import { VerificationStateResult } from "@/lib/verification-state";
import { TrustBadge } from "./TrustBadge";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { Shield, ShieldAlert, KeyRound, CalendarClock } from "lucide-react";

interface VerificationMetadataProps {
  state: VerificationStateResult | null;
  className?: string;
  showBreakdown?: boolean;
  isDemo?: boolean;
}

export const VerificationMetadata: React.FC<VerificationMetadataProps> = ({ 
  state,
  className = "",
  showBreakdown = false,
  isDemo = false
}) => {
  if (!state) return null;

  const isVerified = state.confidenceTier === "HIGH_CONFIDENCE" || state.confidenceTier === "REVENUE_VERIFIED" || state.confidenceTier === "PAYMENT_CONNECTED";

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {/* Primary Verification Badge */}
      <div className="flex flex-wrap items-center gap-2">
        <TrustBadge tier={state.confidenceTier} showGlow isDemo={isDemo} />
        <FreshnessIndicator lastSyncAt={state.lastSyncAt} isDemo={isDemo} />
      </div>

      {/* Breakdown/Secondary Metadata */}
      {showBreakdown && (
        <div className="flex flex-col gap-2 mt-1">
          {/* Status & Expiration Row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 ${isDemo ? "bg-amber-500/10 border-amber-500/20" : isVerified ? "bg-emerald-500/10 border-emerald-500/20" : "bg-neutral-800/50 border-white/5"}`}>
              {isDemo ? <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" /> : isVerified ? <Shield className="w-3 h-3 text-emerald-500 shrink-0" /> : <ShieldAlert className="w-3 h-3 text-neutral-500 shrink-0" />}
              <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-neutral-400">Status</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${isDemo ? "text-amber-500" : isVerified ? "text-emerald-500" : "text-neutral-500"}`}>
                {isDemo ? "Sandbox Mode" : isVerified ? "Active" : "Unverified"}
              </span>
            </div>

            <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-1.5">
              <CalendarClock className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-neutral-400">Expiration</span>
              <span className="text-[9px] font-bold leading-none text-neutral-600">
                {isDemo ? "N/A (Demo)" : isVerified ? "Auto-renews dynamically" : "N/A"}
              </span>
            </div>
          </div>

          {/* Sources & Window Row */}
          <div className="flex flex-wrap items-center gap-2">
            {state.providersConnected && state.providersConnected.length > 0 ? (
              state.providersConnected.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
                >
                  <KeyRound className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-indigo-300">
                    {provider}
                  </span>
                  <span className="text-[9px] font-bold leading-none text-indigo-500">
                    {isDemo ? "Simulated" : "Linked"}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-neutral-500">
                  No Payment Source Linked
                </span>
              </div>
            )}
            
            <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-neutral-400">Reporting Window</span>
              <span className="text-[9px] font-bold leading-none text-neutral-600">Trailing 30 Days</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
