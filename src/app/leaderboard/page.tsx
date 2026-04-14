"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, TrendingUp, AlertTriangle, Info, Search } from "lucide-react";
import Link from "next/link";

type LeaderboardRow = {
  id: number;
  rank: number;
  startup_name: string;
  founder: string;
  mrr: number;
  growth_pct: number | null;
  city: string;
  verification_status: string;
  confidence_score: number;
  final_score: number | null;
  verification_label: string | null;
  risk_level: string | null;
  trust_breakdown?: any;
  trust_summary?: string[];
  verified_revenue: number | null;
  proof_url: string | null;
};

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value);
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("startup_submissions")
        .select("*")
        .order("final_score", { ascending: false });

      if (error) {
        setLoadError("Unable to load leaderboard.");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []).map((item, index) => ({
        ...item,
        rank: index + 1,
        founder: item.founder_name || item.name || "Founder not provided",
      })));
      setLoading(false);
    };
    fetchRows();
  }, []);

  const totalMrr = useMemo(() => rows.reduce((sum, row) => sum + (row.mrr || 0), 0), [rows]);

  const getStrengthLevel = (score: number) => {
    if (score >= 70) return { label: "Strong", color: "text-green-400 bg-green-400/10 border-green-400/20" };
    if (score >= 31) return { label: "Moderate", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
    return { label: "Weak", color: "text-red-400 bg-red-400/10 border-red-400/20" };
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* Header Stats */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">Verified Startup Rankings</h1>
              <p className="text-neutral-400 max-w-xl text-lg">Ranking fastest-growing startups based on verified revenue and profile strength.</p>
            </div>
            <div className="flex gap-4">
               <div className="bg-neutral-900 border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Total MRR</p>
                  <p className="text-xl font-bold text-indigo-400">{formatInr(totalMrr)}</p>
               </div>
               <div className="bg-neutral-900 border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Startups</p>
                  <p className="text-xl font-bold">{rows.length}</p>
               </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3 p-2 bg-neutral-900/50 border border-white/5 rounded-2xl max-w-md">
             <div className="bg-white/5 p-2 rounded-xl"><Search className="w-4 h-4 text-neutral-500" /></div>
             <input placeholder="Search company or founder..." className="bg-transparent text-sm outline-none w-full" />
          </div>
        </section>

        {/* Leaderboard Table */}
        <section className="bg-neutral-900/30 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-12 px-8 py-6 text-[10px] uppercase font-black text-neutral-500 tracking-[0.2em] border-b border-white/5">
             <div className="col-span-1">Rank</div>
             <div className="col-span-4">Company & Founder</div>
             <div className="col-span-2 text-right">Revenue</div>
             <div className="col-span-3 text-center">Profile Strength</div>
             <div className="col-span-2 text-right">Status</div>
          </div>

          {loading ? (
             <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-700" /></div>
          ) : rows.length === 0 ? (
             <div className="p-20 text-center text-neutral-500 font-bold uppercase tracking-widest">No verified startups yet</div>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((row) => {
                const strength = getStrengthLevel(row.final_score || 0);
                return (
                  <Link 
                    href={`/startup/${row.id}`} 
                    key={row.id}
                    className="grid grid-cols-12 px-8 py-6 items-center hover:bg-white/5 transition-all group"
                  >
                    <div className="col-span-1 font-black text-lg text-neutral-700 group-hover:text-indigo-500 transition-colors">
                      {row.rank.toString().padStart(2, '0')}
                    </div>
                    
                    <div className="col-span-4 space-y-1">
                       <p className="font-bold text-base tracking-tight">{row.startup_name}</p>
                       <p className="text-xs text-neutral-500 font-medium">{row.founder}</p>
                    </div>

                    <div className="col-span-2 text-right">
                       <p className="font-bold text-white tabular-nums">{formatInr(row.mrr)}</p>
                       <p className="text-[10px] text-neutral-600 font-bold uppercase">Monthly</p>
                    </div>

                    <div className="col-span-3 flex flex-col items-center gap-2">
                       <div className="w-full max-w-[120px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${strength.color.split(' ')[0].replace('text-', 'bg-')}`} 
                            style={{ width: `${Math.max(10, row.final_score || 0)}%` }} 
                          />
                       </div>
                       <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${strength.color} ${strength.bg} ${strength.border}`}>
                          {strength.label}
                       </span>
                    </div>

                    <div className="col-span-2 flex justify-end">
                       {row.verification_status === 'approved' ? (
                          <div className="flex items-center gap-2 text-green-400 bg-green-400/5 px-3 py-1.5 rounded-xl border border-green-400/10">
                             <ShieldCheck className="w-4 h-4" />
                             <span className="text-[10px] font-black uppercase">Verified</span>
                          </div>
                       ) : (
                          <div className="flex items-center gap-2 text-neutral-500">
                             <CircleDashed className="w-4 h-4" />
                             <span className="text-[10px] font-black uppercase">Auditing</span>
                          </div>
                       )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Incentive Footer */}
        <section className="mt-12 text-center space-y-4">
           <div className="inline-flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <p className="text-sm text-neutral-400">
                Top individual startups have a <span className="text-white font-black">Strong (70+)</span> profile strength. 
                <Link href="/add-startup" className="text-indigo-400 font-bold ml-1 hover:underline">Get started →</Link>
              </p>
           </div>
        </section>
      </main>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CircleDashed(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.1 2.18a10 10 0 0 1 3.8 0" />
      <path d="M17.6 4.38a10 10 0 0 1 2.02 2.02" />
      <path d="M21.82 10.1a10 10 0 0 1 0 3.8" />
      <path d="M19.62 17.6a10 10 0 0 1-2.02 2.02" />
      <path d="M13.9 21.82a10 10 0 0 1-3.8 0" />
      <path d="M6.4 19.62a10 10 0 0 1-2.02-2.02" />
      <path d="M2.18 13.9a10 10 0 0 1 0-3.8" />
      <path d="M4.38 6.4a10 10 0 0 1 2.02-2.02" />
    </svg>
  );
}
