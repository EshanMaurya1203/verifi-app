import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Clock } from "lucide-react";
import type { FounderAction } from "@/lib/dashboard/getNextFounderAction";

interface NextActionCardProps {
  action: FounderAction;
}

// Derive a rough time estimate from the action type. This is purely presentational.
function getEstimatedTime(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("profile") || lower.includes("publish")) return "~2 minutes";
  if (lower.includes("revenue") || lower.includes("declare")) return "~1 minute";
  if (lower.includes("proof") || lower.includes("upload")) return "~3 minutes";
  if (lower.includes("connect") || lower.includes("provider")) return "~5 minutes";
  if (lower.includes("verification") || lower.includes("complete")) return "~5 minutes";
  if (lower.includes("share")) return "~1 minute";
  return null;
}

export function NextActionCard({ action }: NextActionCardProps) {
  const estimate = getEstimatedTime(action.title);

  return (
    <div className="mb-8 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Next Recommended Action
            </span>
          </div>
          <h3 className="font-syne text-xl sm:text-2xl font-bold mb-1.5">
            {action.title}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xl mb-2">
            {action.description}
          </p>
          {estimate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Estimated time: {estimate}</span>
            </div>
          )}
        </div>
        
        <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          <Link
            href={action.href}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-[#a8e630] hover:-translate-y-0.5 shadow-sm hover:shadow-md text-center"
          >
            <span className="truncate">{action.cta}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
