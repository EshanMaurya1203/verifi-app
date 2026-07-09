import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProgressResult } from "@/lib/dashboard/getFounderProgress";

interface ProgressChecklistProps {
  progress: ProgressResult;
}

export function ProgressChecklist({ progress }: ProgressChecklistProps) {
  const { allMilestones, remainingMilestones } = progress;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-syne text-lg font-bold mb-3">Milestones</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {allMilestones.map((m) => {
          if (m.completed) {
            return (
              <div key={m.id} className="flex items-start gap-2.5 py-1 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                <span className="text-sm line-through opacity-60 leading-tight">{m.label}</span>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex items-start gap-2.5 py-1 text-foreground">
              <Circle className="h-4 w-4 mt-0.5 shrink-0 text-primary fill-primary/10" />
              <span className="text-sm font-semibold leading-tight">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
