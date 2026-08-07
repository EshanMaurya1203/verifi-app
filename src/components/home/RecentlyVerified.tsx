"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useStartupData } from "./StartupDataProvider";

export function RecentlyVerified() {
  const { recentlyListedData, loading, error } = useStartupData();

  return (
    <section>
      <div className="flex items-center justify-between mb-6 px-2">
        <div>
          <h3 className="font-syne text-sm font-black text-white uppercase tracking-wider">
            Recently Verified
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-[#09090b]/30 border border-white/[0.05] p-5 rounded-3xl animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-neutral-800 rounded-xl" />
                <div className="space-y-2 w-2/3">
                  <div className="h-4 bg-neutral-800 rounded w-full" />
                  <div className="h-3 bg-neutral-900 rounded w-1/2" />
                </div>
              </div>
              <div className="h-8 bg-neutral-900 rounded w-full mt-4" />
            </div>
          ))
        ) : error ? (
          <div className="col-span-2 px-6 py-10 text-center flex flex-col items-center justify-center bg-black/10 rounded-3xl border border-white/[0.05]">
            <AlertTriangle className="w-6 h-6 text-amber-500/80 mb-2 animate-pulse" />
            <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
              Sync Offline
            </p>
          </div>
        ) : recentlyListedData.length === 0 ? (
          <div className="col-span-2 px-6 py-10 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest bg-black/10 rounded-3xl">
            No startups listed yet.
          </div>
        ) : (
          recentlyListedData.map((s) => (
            <Link
              href={`/startup/${s.slug}`}
              key={s.name}
              className="bg-[#09090b]/30 border border-white/[0.05] p-5 rounded-3xl relative overflow-hidden group hover:border-white/10 hover:bg-[#0a0a0d]/50 transition-all duration-300 ring-1 ring-white/[0.01]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-800/80 border border-white/5 font-syne text-[10px] font-bold text-white shadow-inner shrink-0">
                  {s.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                    {s.name}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                    {s.category}
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/[0.04] pt-3 mt-3">
                <div>
                  <div className="font-syne text-sm font-black text-white leading-none tracking-tight">
                    {s.mrr}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mt-1">
                    MRR
                  </div>
                </div>
                <div className="rounded-full bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                  {s.badge}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
