"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MRRWidgetProps {
  formattedMRR: string;
  formattedGrowth: string;
  trend: "up" | "down" | "neutral";
  trendColor: string;
}

export function MRRWidget({ formattedMRR, formattedGrowth, trend, trendColor }: MRRWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
      <h3 className="text-sm font-medium tracking-tight mb-2">Monthly Recurring Revenue</h3>
      <div className="text-2xl font-bold">{formattedMRR}</div>
      <p className="text-xs text-muted-foreground flex items-center mt-2">
        <span className={`flex items-center ${trendColor} mr-1 font-medium`}>
          {trend === "up" && <TrendingUp className="h-3 w-3 mr-1" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 mr-1" />}
          {trend === "neutral" && <Minus className="h-3 w-3 mr-1" />}
          {formattedGrowth}
        </span>
        from last month
      </p>
    </div>
  );
}
