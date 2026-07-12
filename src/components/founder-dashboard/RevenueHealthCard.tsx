"use client";

import { CheckCircle2, Clock, AlertTriangle, AlertCircle } from "lucide-react";

interface RevenueHealthCardProps {
  health: {
    statusText: string;
    statusLevel: "healthy" | "warning" | "empty";
  };
  freshness: {
    freshnessStatus: "fresh" | "aging" | "stale" | "never_synced";
    freshnessLabel: string;
    freshnessColor: string;
  };
}

export function RevenueHealthCard({ health, freshness }: RevenueHealthCardProps) {
  const getFreshnessIcon = () => {
    switch (freshness.freshnessStatus) {
      case "fresh":
        return <CheckCircle2 className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "aging":
        return <Clock className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "stale":
        return <AlertTriangle className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "never_synced":
      default:
        return <AlertCircle className={`h-4 w-4 ${freshness.freshnessColor}`} />;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
      <h3 className="text-sm font-medium tracking-tight mb-4">Data Health</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm border-b pb-2">
          <span className="text-muted-foreground">Tracking Status</span>
          <span className="font-medium">{health.statusText}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Data Freshness</span>
          <div className="flex items-center gap-1.5 font-medium">
            {getFreshnessIcon()}
            <span className={freshness.freshnessColor}>{freshness.freshnessLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
