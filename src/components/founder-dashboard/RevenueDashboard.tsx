"use client";

import { RevenueDashboardViewModel } from "@/lib/dashboard/revenue-presenter";
import { MRRWidget } from "./MRRWidget";
import { ARRWidget } from "./ARRWidget";
import { RevenueBreakdownWidget } from "./RevenueBreakdownWidget";
import { RevenueHealthCard } from "./RevenueHealthCard";
import { RevenueChart } from "@/components/startup/RevenueChart";

interface RevenueDashboardProps {
  viewModel: RevenueDashboardViewModel;
}

export function RevenueDashboard({ viewModel }: RevenueDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MRRWidget 
          formattedMRR={viewModel.heroMetrics.formattedMRR}
          formattedGrowth={viewModel.heroMetrics.formattedGrowth}
          trend={viewModel.heroMetrics.trend}
          trendColor={viewModel.heroMetrics.trendColor}
        />
        <ARRWidget 
          formattedARR={viewModel.heroMetrics.formattedARR}
        />
        <RevenueBreakdownWidget 
          providers={viewModel.breakdown.providers}
          hasMultiple={viewModel.breakdown.hasMultiple}
        />
        <RevenueHealthCard 
          health={viewModel.health}
          freshness={viewModel.freshness}
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold tracking-tight">Revenue Trend</h3>
        </div>
        <div className="p-2">
          {!viewModel.chart.isEmpty ? (
            <RevenueChart data={viewModel.chart.series} />
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-neutral-900/40 rounded-[2rem] border border-white/5 m-4">
              <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest text-center">
                Insufficient data for trend analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
