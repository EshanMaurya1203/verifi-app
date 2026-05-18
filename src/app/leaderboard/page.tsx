import { getSupabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, TrendingUp, AlertTriangle, ChevronRight, Info, Award, Clock } from "lucide-react";
import Link from "next/link";
import { getStartupMetrics } from "@/lib/revenue-aggregation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Live revenue rankings for verified internet startups. Backed by real-time payment provider streams.",
  alternates: {
    canonical: "/leaderboard",
  },
};

function TierBadge({ tier, status }: { tier: string, status: string }) {
  // Map DB trust_tier to confidence-based display tiers
  // Supports both legacy (verified/trusted/emerging/unverified) and new (high_confidence/revenue_verified/payment_connected/self_reported) keys
  const config: Record<string, { label: string, color: string, icon: any, glow?: string }> = {
    // New confidence-based tiers
    high_confidence: { 
      label: "High Confidence", 
      color: "bg-green-500/10 text-green-400 border-green-500/20", 
      icon: ShieldCheck,
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]"
    },
    revenue_verified: { 
      label: "Revenue Verified", 
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
      icon: Award,
      glow: "shadow-[0_0_10px_rgba(59,130,246,0.1)]"
    },
    payment_connected: { 
      label: "Payment Connected", 
      color: "bg-yellow-500/10 text-yellow-500/80 border-yellow-500/20", 
      icon: TrendingUp 
    },
    self_reported: { 
      label: "Self Reported", 
      color: "bg-neutral-800/50 text-neutral-500 border-neutral-700/50", 
      icon: Clock 
    },
    // Legacy tier aliases (for existing DB records)
    verified: { 
      label: "High Confidence", 
      color: "bg-green-500/10 text-green-400 border-green-500/20", 
      icon: ShieldCheck,
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]"
    },
    trusted: { 
      label: "Revenue Verified", 
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
      icon: Award,
      glow: "shadow-[0_0_10px_rgba(59,130,246,0.1)]"
    },
    emerging: { 
      label: "Payment Connected", 
      color: "bg-yellow-500/10 text-yellow-500/80 border-yellow-500/20", 
      icon: TrendingUp 
    },
    unverified: { 
      label: "Self Reported", 
      color: "bg-neutral-800/50 text-neutral-500 border-neutral-700/50", 
      icon: Clock 
    },
    flagged: { 
      label: "Self Reported", 
      color: "bg-neutral-800/50 text-neutral-500 border-neutral-700/50", 
      icon: Clock 
    },
  };

  // Flagged accounts silently downgrade to Self Reported (no scary wording)
  const activeTier = status === "flagged" ? "flagged" : tier;
  const { label, color, icon: Icon, glow } = config[activeTier] || config.self_reported;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${color} ${glow || ''}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = getSupabaseServer();
  
  const { data, error } = await supabase
    .from("startup_submissions")
    .select("*")
    .order("mrr", { ascending: false });

  if (error) {
    console.error("Leaderboard Server Fetch Error:", error);
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
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Active Pool</span>
                <span className="text-lg font-black font-syne text-white mt-1">{sortedData.length} Companies</span>
             </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <section className="bg-[#09090b]/30 border border-white/[0.06] rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md ring-1 ring-white/[0.02]">
          <div className="grid grid-cols-12 px-6 md:px-10 py-6 text-[10px] uppercase font-black text-neutral-500 tracking-[0.2em] border-b border-white/[0.05] bg-[#09090b]/60">
            <div className="col-span-2 md:col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-4">Company</div>
            <div className="col-span-4 md:col-span-3 text-right px-2 md:px-4">Verified MRR & Growth</div>
            <div className="col-span-3 hidden md:flex justify-center">Verification Tier</div>
            <div className="col-span-1 hidden md:block"></div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {sortedData.map((row, i) => {
              const isFlagged = row.verification_status === "flagged";
              const isVerified = (row.trust_tier || row.verification_status) === "verified";
              
              return (
                <Link 
                  href={`/startup/${row.slug}`} 
                  key={row.id}
                  className={`grid grid-cols-12 px-6 md:px-10 py-6 md:py-8 items-center hover:bg-white/[0.015] transition-all group ${isFlagged ? 'opacity-50 grayscale' : ''} ${isVerified ? 'bg-indigo-500/[0.005]' : ''}`}
                >
                  <div className="col-span-2 md:col-span-1 text-center font-syne text-[14px] md:text-lg font-black text-neutral-600 group-hover:text-neutral-400 transition-colors">
                    {i + 1}
                  </div>
                  
                  <div className="col-span-6 md:col-span-4 space-y-1.5">
                    <p className="font-black text-sm md:text-lg tracking-tight group-hover:text-indigo-400 transition-colors uppercase leading-none">{row.startup_name || row.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                       <span className="text-[10px] md:text-xs text-neutral-500 font-bold">{row.founder_name || "Anonymous"}</span>
                       <div className="w-1 h-1 bg-neutral-800 rounded-full" />
                       <span className="text-[9px] md:text-[10px] text-neutral-600 font-bold uppercase">{row.city || 'India'}</span>
                    </div>
                    {/* Inline Badge for Mobile */}
                    <div className="md:hidden mt-2">
                      <TierBadge tier={row.trust_tier || "unverified"} status={row.verification_status || "unverified"} />
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-3 text-right px-2 md:px-4">
                    <p className="font-syne text-base md:text-xl text-white font-black tracking-tight tabular-nums leading-none">{formatInr(row.mrr || 0)}</p>
                    <p className="text-[9px] md:text-[10px] mt-1.5 space-x-1 md:space-x-2 leading-none flex flex-wrap justify-end gap-1">
                       <span className="text-neutral-600 font-black uppercase hidden sm:inline">Monthly Audited</span>
                       {row.growth !== undefined && (
                         <span className={row.growth > 0 ? "text-green-400 font-bold" : row.growth < 0 ? "text-red-400 font-bold" : "text-neutral-500 font-bold"}>
                           {row.growth > 0 ? '+' : ''}{row.growth}% MoM
                         </span>
                       )}
                    </p>
                  </div>

                  <div className="col-span-3 hidden md:flex justify-center">
                    <TierBadge tier={row.trust_tier || "unverified"} status={row.verification_status || "unverified"} />
                  </div>

                  <div className="col-span-1 hidden md:flex justify-end">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center group-hover:border-indigo-500/50 transition-colors shadow-lg">
                       <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-white transition-all transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
            {sortedData.length === 0 && (
              <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-neutral-800 mb-4" />
                <p className="text-[11px] uppercase font-black tracking-widest text-neutral-500">No verified startups yet</p>
                <p className="text-[10px] text-neutral-600 font-bold mt-2 max-w-sm leading-relaxed">The leaderboard is currently empty. Connect your payment provider to become the first verified startup.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
