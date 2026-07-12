import { RevenueAnalyticsSnapshot } from "./revenue-engine";
import { formatCurrency, formatGrowth } from "@/lib/formatters";

export interface RevenueDashboardViewModel {
  heroMetrics: {
    formattedMRR: string;
    formattedARR: string;
    formattedGrowth: string;
    trend: "up" | "down" | "neutral";
    trendColor: string;
  };
  chart: {
    series: { date: string; amount: number; timestamp: number }[];
    isEmpty: boolean;
  };
  breakdown: {
    providers: { name: string; formattedAmount: string; percentage: number; color: string }[];
    hasMultiple: boolean;
  };
  health: {
    statusText: string;
    statusLevel: "healthy" | "warning" | "empty";
  };
  freshness: {
    freshnessStatus: "fresh" | "aging" | "stale" | "never_synced";
    freshnessLabel: string;
    freshnessColor: string;
  };
  emptyState: boolean;
}

export function presentRevenueDashboard(snapshot: RevenueAnalyticsSnapshot): RevenueDashboardViewModel {
  const trend = snapshot.growthPercentage > 0 ? "up" : snapshot.growthPercentage < 0 ? "down" : "neutral";
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-neutral-400";
  
  const series = snapshot.history.map(h => ({
    date: h.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: h.amount,
    timestamp: h.date.getTime(),
  }));

  const totalBreakdownAmount = Object.values(snapshot.providerBreakdown).reduce((sum, val) => sum + val, 0);

  const providers = Object.entries(snapshot.providerBreakdown).map(([name, amount], index) => {
    const percentage = totalBreakdownAmount > 0 ? (amount / totalBreakdownAmount) * 100 : 0;
    const colors = ["#10b981", "#6366f1", "#f59e0b", "#ec4899"];
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      formattedAmount: formatCurrency(amount, "INR", { compact: true }),
      percentage,
      color: colors[index % colors.length]
    };
  });

  // Calculate freshness
  let freshnessStatus: "fresh" | "aging" | "stale" | "never_synced" = "never_synced";
  let freshnessLabel = "Never synced";
  let freshnessColor = "text-neutral-500";

  if (snapshot.lastSyncedAt) {
    const hoursSinceSync = (Date.now() - snapshot.lastSyncedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync < 6) {
      freshnessStatus = "fresh";
      freshnessLabel = "Synced recently";
      freshnessColor = "text-emerald-400";
    } else if (hoursSinceSync < 24) {
      freshnessStatus = "aging";
      freshnessLabel = "Synced today";
      freshnessColor = "text-amber-400";
    } else {
      freshnessStatus = "stale";
      const days = Math.floor(hoursSinceSync / 24);
      freshnessLabel = `Synced ${days} day${days > 1 ? "s" : ""} ago`;
      freshnessColor = "text-neutral-400";
    }
  }

  let statusText = "Awaiting Data";
  let statusLevel: "healthy" | "warning" | "empty" = "empty";
  
  if (snapshot.hasData) {
    statusText = "Revenue Tracked";
    statusLevel = "healthy";
  }

  return {
    heroMetrics: {
      formattedMRR: formatCurrency(snapshot.mrr, "INR", { compact: false }),
      formattedARR: formatCurrency(snapshot.arr, "INR", { compact: true }),
      formattedGrowth: formatGrowth(snapshot.growthPercentage),
      trend,
      trendColor,
    },
    chart: {
      series,
      isEmpty: !snapshot.hasData,
    },
    breakdown: {
      providers,
      hasMultiple: snapshot.hasMultipleProviders,
    },
    health: {
      statusText,
      statusLevel,
    },
    freshness: {
      freshnessStatus,
      freshnessLabel,
      freshnessColor,
    },
    emptyState: !snapshot.hasData,
  };
}
