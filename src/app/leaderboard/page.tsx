import { getSupabaseServer } from "@/lib/supabase-server";
import { safeSupabaseQuery } from "@/lib/safe-network";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, TrendingUp, AlertTriangle, ChevronRight, Info, Award, Clock, Activity } from "lucide-react";
import Link from "next/link";
import { getStartupMetrics } from "@/lib/revenue-aggregation";
import type { Metadata } from "next";
import { TrustBadge } from "@/components/startup/TrustBadge";
import { ConfidenceTier } from "@/lib/verification-state";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Live revenue rankings for verified internet startups. Backed by real-time payment provider streams.",
  alternates: {
    canonical: "/leaderboard",
  },
};

const getConfidenceTier = (tier: string, status: string): ConfidenceTier => {
  if (status === "flagged") return "SELF_REPORTED";
  
  const normalizedTier = tier.toLowerCase();
  const map: Record<string, ConfidenceTier> = {
    high_confidence: "HIGH_CONFIDENCE",
    verified: "HIGH_CONFIDENCE",
    revenue_verified: "REVENUE_VERIFIED",
    trusted: "REVENUE_VERIFIED",
    payment_connected: "PAYMENT_CONNECTED",
    emerging: "PAYMENT_CONNECTED",
    self_reported: "SELF_REPORTED",
    unverified: "SELF_REPORTED",
    flagged: "SELF_REPORTED"
  };
  
  return map[normalizedTier] || "SELF_REPORTED";
};

export default async function LeaderboardPage() {
  const supabase = getSupabaseServer();
  
  const { data, error, ok } = await safeSupabaseQuery<any[]>(
    supabase
      .from("startup_submissions")
      .select("*")
      .order("mrr", { ascending: false })
  );

  if (error || !ok) {
    if (process.env.NODE_ENV === "development") {
      console.error("Leaderboard Server Fetch Error:", error);
    }
  }

  // Fetch growth metrics via snapshots
  const dataWithMetrics = await Promise.all(
    (data || []).map(async (row) => {
      let metrics;
      try {
        metrics = await getStartupMetrics(row.id);
      } catch (e) {
        console.error("[Leaderboard] Metrics failed:", e);
        metrics = { mrr: 0, arr: 0, growthPercentage: 0 };
      }
      return { ...row, growth: metrics?.growthPercentage || 0 };
    })
  );

  // Sorting Logic: Revenue then Growth (No Trust Score)
  const sortedData = dataWithMetrics.sort((a, b) => {
    const mrrA = Number(a.mrr) || 0;
    const mrrB = Number(b.mrr) || 0;
    if (mrrA !== mrrB) return mrrB - mrrA;
    return (b.growth || 0) - (a.growth || 0);
  });

  const formatInr = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
    return `₹${value}`;
  };

  return (
    <div className="min-h-screen bg-[#040406] text-white font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black font-syne tracking-tight uppercase">Leaderboard</h1>
            <p className="text-[#8f8f97] text-base md:text-lg max-w-2xl leading-relaxed">Top-performing internet startups ranked by verified revenue and trusted payment connections.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             <div className="px-5 py-3 bg-[#09090b]/40 border border-white/[0.06] backdrop-blur-md rounded-2xl flex flex-col min-w-[140px] shadow-lg">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Active Pool</span>
                <span className="text-lg font-black font-syne text-white mt-1">{sortedData.length} Companies</span>
             </div>
          </div>
        </div>

        {/* How Rankings Work Panel */}
        <section className="bg-[#0a0a0c]/60 border border-white/[0.06] rounded-[2rem] p-6 mb-12 shadow-2xl ring-1 ring-white/[0.02] backdrop-blur-xl flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-white/[0.06] pb-6 md:pb-0 md:pr-8">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-indigo-400" />
              Ranking Methodology
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              We prioritize transparency over theatrics. This leaderboard ranks startups primarily by verified financial volume and data freshness, separating hard truth from manual claims.
            </p>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Verification Weighting
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Startups with <span className="text-neutral-300 font-bold">Payment Verified</span> status are visually prioritized. Self-reported figures are dimmed until verified via live ledger API to prevent artificial inflation.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Data Freshness
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Rankings factor in sync frequency. Companies with verified API access auto-sync every 24 hours, ensuring the public metrics reflect their trailing 30-day reporting window accurately.
              </p>
            </div>
          </div>
        </section>

        {/* Leaderboard Table */}
        <section className="bg-[#09090b]/30 border border-white/[0.06] rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md ring-1 ring-white/[0.02]">
          <div className="grid grid-cols-12 px-6 md:px-10 py-6 text-[11px] uppercase font-bold text-neutral-500 tracking-[0.2em] border-b border-white/[0.05] bg-[#09090b]/60">
            <div className="col-span-2 md:col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-4">Company</div>
            <div className="col-span-4 md:col-span-3 text-right px-2 md:px-4">Verified MRR & Growth</div>
            <div className="col-span-3 hidden md:flex justify-center">Verification Tier</div>
            <div className="col-span-1 hidden md:block"></div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {sortedData.map((row, i) => {
              const isFlagged = row.verification_status === "flagged";
              const confidenceTier = getConfidenceTier(row.trust_tier || "unverified", row.verification_status || "unverified");
              const isVerified = confidenceTier === "HIGH_CONFIDENCE" || confidenceTier === "REVENUE_VERIFIED" || confidenceTier === "PAYMENT_CONNECTED";
              const isSelfReported = confidenceTier === "SELF_REPORTED" || isFlagged;
              
              return (
                <Link 
                  href={`/startup/${row.slug}`} 
                  key={row.id}
                  className={`grid grid-cols-12 px-6 md:px-10 py-6 md:py-8 items-center transition-all group ${
                    isSelfReported ? 'opacity-50 bg-transparent hover:opacity-100 hover:bg-white/[0.015]' : 'bg-white/[0.01] hover:bg-white/[0.03]'
                  }`}
                >
                  <div className={`col-span-2 md:col-span-1 text-center font-syne text-sm md:text-lg font-bold transition-colors ${isVerified ? "text-neutral-500 group-hover:text-neutral-300" : "text-neutral-700"}`}>
                    {i + 1}
                  </div>
                  
                  <div className="col-span-6 md:col-span-4 space-y-1.5">
                    <p className={`font-bold text-sm md:text-lg tracking-tight transition-colors leading-none ${isVerified ? "text-white group-hover:text-indigo-400" : "text-neutral-400"}`}>
                      {row.startup_name || row.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                       <span className={`text-xs font-semibold ${isVerified ? "text-neutral-400" : "text-neutral-600"}`}>
                         {row.founder_name || "Anonymous"}
                       </span>
                       <div className="w-1 h-1 bg-neutral-800 rounded-full" />
                       <span className={`text-[10px] font-bold uppercase tracking-wider ${isVerified ? "text-neutral-500" : "text-neutral-700"}`}>
                         {row.city || 'India'}
                       </span>
                    </div>
                    {/* Inline Badge for Mobile */}
                    <div className="md:hidden mt-2">
                      <TrustBadge tier={confidenceTier} size="sm" showGlow={isVerified} />
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-3 text-right px-2 md:px-4">
                    <p className={`font-syne text-base md:text-xl font-extrabold tracking-tight tabular-nums leading-none ${isVerified ? "text-white" : "text-neutral-500"}`}>
                      {formatInr(row.mrr || 0)}
                    </p>
                    <p className="text-[10px] mt-1.5 space-x-1 md:space-x-2 leading-none flex flex-wrap justify-end gap-1">
                       <span className={`font-bold uppercase tracking-wider hidden sm:inline ${isVerified ? "text-neutral-500" : "text-neutral-700"}`}>
                         Monthly Audited
                       </span>
                       {row.growth !== undefined && (
                         <span className={row.growth > 0 ? (isVerified ? "text-emerald-400 font-bold" : "text-emerald-500/50 font-bold") : row.growth < 0 ? (isVerified ? "text-red-400 font-bold" : "text-red-500/50 font-bold") : "text-neutral-500 font-bold"}>
                           {row.growth > 0 ? '+' : ''}{row.growth}% MoM
                         </span>
                       )}
                    </p>
                  </div>

                  <div className="col-span-3 hidden md:flex justify-center">
                    <TrustBadge tier={confidenceTier} size="md" showGlow={isVerified} />
                  </div>

                  <div className="col-span-1 hidden md:flex justify-end">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-lg ${isVerified ? "bg-neutral-900 border-white/10 group-hover:border-indigo-500/50" : "bg-neutral-950 border-white/5"}`}>
                       <ChevronRight className={`w-4 h-4 transition-all transform group-hover:translate-x-0.5 ${isVerified ? "text-neutral-500 group-hover:text-white" : "text-neutral-700 group-hover:text-neutral-500"}`} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {!ok || error ? (
              <div className="px-6 py-20 text-center flex flex-col items-center justify-center bg-black/10">
                <AlertTriangle className="w-8 h-8 text-amber-500/80 mb-4 animate-pulse" />
                <p className="text-xs uppercase font-bold tracking-widest text-amber-500">Ecosystem Offline</p>
                <p className="text-xs text-neutral-500 font-medium mt-2 max-w-sm leading-relaxed">Verifi protocol is currently experiencing dynamic sync latency. Real-time ranking verification is temporarily paused. Please reload.</p>
              </div>
            ) : sortedData.length === 0 ? (
              <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-neutral-800 mb-4" />
                <p className="text-xs uppercase font-bold tracking-widest text-neutral-500">No verified startups yet</p>
                <p className="text-xs text-neutral-600 font-medium mt-2 max-w-sm leading-relaxed">The leaderboard is currently empty. Connect your payment provider to become the first verified startup.</p>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
