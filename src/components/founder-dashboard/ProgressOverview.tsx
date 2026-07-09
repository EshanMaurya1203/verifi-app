import React from "react";
import type { ProgressResult } from "@/lib/dashboard/getFounderProgress";

interface ProgressOverviewProps {
  progress: ProgressResult;
  statusMessage: string;
}

export function ProgressOverview({ progress, statusMessage }: ProgressOverviewProps) {
  const { percentage, completedCount, remainingCount } = progress;
  const totalCount = completedCount + remainingCount;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="mb-4">
        <div className="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight">
          {percentage}% <span className="text-muted-foreground font-medium text-2xl sm:text-3xl">Complete</span>
        </div>
      </div>
      
      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden mb-4">
        <div 
          className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" 
          style={{ width: `${percentage}%` }} 
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">
          <span className="font-bold text-foreground">{completedCount}</span> of{" "}
          <span className="font-bold text-foreground">{totalCount}</span> milestones completed
        </p>
        <p className="text-muted-foreground text-sm max-w-md text-left sm:text-right">
          {statusMessage}
        </p>
      </div>
    </div>
  );
}
