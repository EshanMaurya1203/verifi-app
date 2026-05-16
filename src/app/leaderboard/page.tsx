import { getSupabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, TrendingUp, AlertTriangle, ChevronRight, Info, Award, Clock } from "lucide-react";
import Link from "next/link";
import { getStartupMetrics } from "@/lib/revenue-aggregation";

function TierBadge({ tier, status }: { tier: string, status: string }) {
  // Flagged override
  const activeTier = status === "flagged" ? "flagged" : tier;

  const config: Record<string, { label: string, color: string, icon: any, glow?: string }> = {
    verified: { 
      label: "Verified", 
      color: "bg-green-500/10 text-green-400 border-green-500/20", 
      icon: ShieldCheck,
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]"
    },
    trusted: { 
      label: "Trusted", 
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
      icon: Award,
      glow: "shadow-[0_0_10px_rgba(59,130,246,0.1)]"
    },
    emerging: { 
      label: "Emerging", 
      color: "bg-yellow-500/10 text-yellow-500/80 border-yellow-500/20", 
      icon: TrendingUp 
    },
    unverified: { 
      label: "Reviewing", 
      color: "bg-neutral-800/50 text-neutral-500 border-neutral-700/50", 
      icon: Clock 
    },
    flagged: { 
      label: "Needs Review", 
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20", 
      icon: AlertTriangle 
    },
  };

  const { label, color, icon: Icon, glow } = config[activeTier] || config.unverified;

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

  const formatInr = (value: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Financial Leaderboard</h1>
            <p className="text-neutral-400 text-lg">Ranking startups by verified revenue and audited trust tiers.</p>
          </div>
          <div className="flex gap-2">
             <div className="px-4 py-2 bg-neutral-900 border border-white/5 rounded-2xl flex flex-col">
                <span className="text-[9px] font-bold text-neutral-600 uppercase">Pool Size</span>
                <span className="text-lg font-black">{sortedData.length} Companies</span>
             </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <section className="bg-neutral-900/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
          <div className="grid grid-cols-12 px-10 py-6 text-[10px] uppercase font-black text-neutral-700 tracking-[0.2em] border-b border-white/5">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-4">Company</div>
            <div className="col-span-3 text-right px-4">Verified MRR & Growth</div>
            <div className="col-span-3 flex justify-center">Trust Integrity Tier</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-white/5">
            {sortedData.map((row, i) => {
              const isFlagged = row.verification_status === "flagged";
              const isVerified = (row.trust_tier || row.verification_status) === "verified";
              
              return (
                <Link 
                  href={`/startup/${row.slug}`} 
                  key={row.id}
                  className={`grid grid-cols-12 px-10 py-8 items-center hover:bg-white/[0.02] transition-all group ${isFlagged ? 'opacity-50 grayscale' : ''} ${isVerified ? 'bg-green-500/[0.01]' : ''}`}
                >
                  <div className="col-span-1 text-center font-black text-xl text-neutral-800 group-hover:text-neutral-600 transition-colors">
                    {i + 1}
                  </div>
                  
                  <div className="col-span-4 space-y-1">
                    <p className="font-black text-lg tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{row.startup_name || row.name}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-neutral-500 font-bold">{row.founder_name || "Anonymous"}</span>
                       <div className="w-1 h-1 bg-neutral-800 rounded-full" />
                       <span className="text-[10px] text-neutral-600 font-bold uppercase">{row.city || 'India'}</span>
                    </div>
                  </div>

                  <div className="col-span-3 text-right px-4">
                    <p className="font-black text-xl text-white tracking-tighter tabular-nums">{formatInr(row.mrr || 0)}</p>
                    <p className="text-[10px] space-x-2">
                       <span className="text-neutral-600 font-black uppercase">Monthly Audited</span>
                       {row.growth !== undefined && (
                         <span className={row.growth > 0 ? "text-green-400 font-bold" : row.growth < 0 ? "text-red-400 font-bold" : "text-neutral-500 font-bold"}>
                           {row.growth > 0 ? '+' : ''}{row.growth}% MoM
                         </span>
                       )}
                    </p>
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <TierBadge tier={row.trust_tier || "unverified"} status={row.verification_status || "unverified"} />
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <div className="w-10 h-10 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center group-hover:border-indigo-500/50 transition-colors">
                       <ChevronRight className="w-5 h-5 text-neutral-700 group-hover:text-white transition-all transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
