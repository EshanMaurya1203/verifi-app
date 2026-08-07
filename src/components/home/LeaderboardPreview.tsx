"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useStartupData } from "./StartupDataProvider";

export function LeaderboardPreview() {
  const { leaderboard, loading, error } = useStartupData();

  return (
    <section>
      <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md overflow-hidden shadow-2xl ring-1 ring-white/[0.02]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.05] px-6 md:px-8 py-5 md:py-6 gap-4">
          <div>
            <h2 className="font-syne text-base md:text-lg font-black text-white uppercase tracking-tight">
              Leaderboard Preview
            </h2>
            <p className="text-[9px] md:text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] mt-1">
              Top performing internet startups
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80 uppercase tracking-wider transition-colors px-4 py-2 rounded-xl bg-primary/10 border border-primary/20"
          >
            View full list
          </Link>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-6 md:px-8 py-5 animate-pulse"
              >
                <div className="flex items-center gap-4 w-1/2">
                  <div className="w-6 h-4 bg-neutral-800 rounded" />
                  <div className="space-y-2 w-full">
                    <div className="h-4 bg-neutral-800 rounded w-2/3" />
                    <div className="h-3 bg-neutral-900 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-6 bg-neutral-800 rounded w-20" />
              </div>
            ))
          ) : error ? (
            <div className="px-8 py-14 text-center flex flex-col items-center justify-center bg-black/10">
              <AlertTriangle className="w-6 h-6 text-amber-500/80 mb-3 animate-pulse" />
              <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
                Sync Interrupted
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs leading-relaxed">
                Could not establish sync with live ledger. Dynamic rankings
                temporarily offline.
              </p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="px-8 py-14 text-center text-xs text-neutral-400 uppercase font-bold tracking-widest bg-black/10">
              No startups verified yet. Be the first to join the leaderboard!
            </div>
          ) : (
            leaderboard.map((startup) => (
              <Link
                href={`/startup/${startup.slug}`}
                key={startup.rank}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-6 md:px-8 py-4 md:py-5 transition-colors hover:bg-white/[0.015] group gap-4 sm:gap-0"
              >
                <div className="flex min-w-0 items-center gap-4 md:gap-5">
                  <div className="w-6 font-syne text-sm font-bold text-neutral-400 text-center">
                    #{startup.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white tracking-wide leading-none group-hover:text-primary transition-colors">
                      {startup.name}
                    </p>
                    <p className="truncate text-xs text-neutral-400 font-medium mt-1.5">
                      by {startup.founder}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-6 ml-10 sm:ml-0">
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="font-syne text-sm font-black text-white tracking-tight tabular-nums">
                      {startup.mrr}
                    </span>
                    <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-widest leading-none mt-1">
                      MRR
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1.5 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider leading-none">
                      Verified
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
