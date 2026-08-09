"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-network";
import { formatCurrency, formatGrowth } from "@/lib/formatters";

export type LeaderboardItem = {
  rank: number;
  slug: string;
  name: string;
  founder: string;
  mrr: string;
  trust_score: number;
};

export type StartupCard = {
  initials: string;
  name: string;
  category: string;
  description: string;
  mrr: string;
  growth: string;
  badge: string;
  slug: string;
};

interface StartupDataContextType {
  leaderboard: LeaderboardItem[];
  recentlyListedData: StartupCard[];
  trendingData: StartupCard[];
  verifiedStartupCount: number;
  verifiedRevenueTotal: number;
  loading: boolean;
  error: string | null;
}

const StartupDataContext = createContext<StartupDataContextType>({
  leaderboard: [],
  recentlyListedData: [],
  trendingData: [],
  verifiedStartupCount: 0,
  verifiedRevenueTotal: 0,
  loading: true,
  error: null,
});

export function useStartupData() {
  return useContext(StartupDataContext);
}

export function StartupDataProvider({ children }: { children: React.ReactNode }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [recentlyListedData, setRecentlyListedData] = useState<StartupCard[]>([]);
  const [trendingData, setTrendingData] = useState<StartupCard[]>([]);
  const [verifiedStartupCount, setVerifiedStartupCount] = useState<number>(0);
  const [verifiedRevenueTotal, setVerifiedRevenueTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomepageData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch submissions securely for leaderboard and canonical trust metrics in parallel
        const [submissionsRes, metricsRes] = await Promise.all([
          safeFetch<{ success: boolean; data: any[] }>("/api/startup-submissions"),
          safeFetch<{
            success: boolean;
            verifiedStartupCount: number;
            verifiedRevenueTotal: number;
          }>("/api/trust-metrics"),
        ]);
        
        if (metricsRes.ok && metricsRes.data?.success) {
          setVerifiedStartupCount(metricsRes.data.verifiedStartupCount ?? 0);
          setVerifiedRevenueTotal(metricsRes.data.verifiedRevenueTotal ?? 0);
        }

        if (!submissionsRes.ok || !submissionsRes.data) {
          setError(submissionsRes.error?.message || "Failed to establish ledger protocol connection.");
          setLoading(false);
          return;
        }

        const { success, data: list } = submissionsRes.data;
        if (success && list) {

          // Top 5 startups for main leaderboard
          const top5 = list
            .slice()
            .sort((a: any, b: any) => (b.mrr || 0) - (a.mrr || 0))
            .slice(0, 5)
            .map((s: any, idx: number) => ({
              rank: idx + 1,
              slug: s.slug || s.id,
              name: s.startup_name,
              founder: s.name || "Anonymous",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              trust_score: s.trust_score || 0,
            }));
          setLeaderboard(top5);

          // Recently listed
          const recent = list
            .slice()
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 4)
            .map((s: any) => ({
              initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
              name: s.startup_name,
              slug: s.slug || s.id,
              category: s.biz_type,
              description: s.notes || "No description provided.",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) : "Stable",
              badge: s.payment_connected ? "Payment Connected" : "Self Reported",
            }));
          setRecentlyListedData(recent);

          // Trending (sorted by growth)
          const trending = list
            .slice()
            .filter((s: any) => s.growth !== undefined && s.growth > 0)
            .sort((a: any, b: any) => (b.growth || 0) - (a.growth || 0))
            .slice(0, 3)
            .map((s: any) => ({
              initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
              name: s.startup_name,
              slug: s.slug || s.id,
              category: s.biz_type,
              description: s.notes || "No description provided.",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) + " MoM" : "",
              badge: "Trending",
            }));
          setTrendingData(trending);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load home data", err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadHomepageData();
  }, []);

  return (
    <StartupDataContext.Provider
      value={{
        leaderboard,
        recentlyListedData,
        trendingData,
        verifiedStartupCount,
        verifiedRevenueTotal,
        loading,
        error,
      }}
    >
      {children}
    </StartupDataContext.Provider>
  );
}
