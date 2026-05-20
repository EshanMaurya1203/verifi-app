"use client";

import React from "react";
import { Clock } from "lucide-react";

interface FreshnessIndicatorProps {
  lastSyncAt: string | null;
  className?: string;
  isDemo?: boolean;
}

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({ 
  lastSyncAt,
  className = "",
  isDemo = false
}) => {
  if (!lastSyncAt) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 ${className}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-amber-500">
          {isDemo ? "Simulated Data" : "Verification Pending"}
        </span>
      </div>
    );
  }

  const syncDate = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - syncDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  let timeString = "Just now";
  let isStale = false;

  if (diffMins >= 1 && diffMins < 60) {
    timeString = `${diffMins}m ago`;
  } else if (diffHours >= 1 && diffHours < 24) {
    timeString = `${diffHours}h ago`;
  } else if (diffDays >= 1) {
    timeString = `${diffDays}d ago`;
    if (diffDays >= 7) {
      isStale = true;
    }
  }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-md ${className}`}>
      <Clock className={`w-3 h-3 ${isStale || isDemo ? "text-amber-500" : "text-emerald-500"}`} />
      <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${isStale || isDemo ? "text-amber-500" : "text-emerald-500"}`}>
        {isDemo ? `Simulated ${timeString}` : `Updated ${timeString}`}
      </span>
    </div>
  );
};
