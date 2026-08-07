"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useStartupData } from "./StartupDataProvider";

export function TrendingSection() {
  const { trendingData } = useStartupData();

  if (trendingData.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="font-syne text-sm font-black text-white uppercase tracking-wider">
            Trending Growth
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {trendingData.map((s) => (
          <Link
            href={`/startup/${s.slug}`}
            key={s.name}
            className="bg-[#09090b]/40 border border-white/[0.05] p-5 rounded-3xl relative overflow-hidden group hover:border-white/10 hover:bg-[#0a0a0d]/60 transition-all duration-300 shadow-md ring-1 ring-white/[0.01]"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-800/80 border border-white/5 font-syne text-[10px] font-bold text-white shadow-inner shrink-0">
                {s.initials}
              </div>
              <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 truncate">
                {s.growth}
              </div>
            </div>

            <div className="text-sm font-bold text-white tracking-wide truncate group-hover:text-emerald-400 transition-colors">
              {s.name}
            </div>
            <div className="mt-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate">
              {s.category}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
