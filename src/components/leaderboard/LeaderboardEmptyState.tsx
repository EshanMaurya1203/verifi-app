"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck, SearchX, RotateCcw } from "lucide-react";

interface LeaderboardEmptyStateProps {
  hasActiveFilters: boolean;
}

export function LeaderboardEmptyState({ hasActiveFilters }: LeaderboardEmptyStateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClearFilters = () => {
    router.push(pathname, { scroll: false });
  };

  if (hasActiveFilters) {
    return (
      <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-4">
          <SearchX className="w-6 h-6 text-neutral-400" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2">
          No Matching Startups
        </h3>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed mb-6">
          We couldn&apos;t find any verified public startups matching your current search or filter combination.
        </p>
        <button
          onClick={handleClearFilters}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
      <ShieldCheck className="w-8 h-8 text-neutral-700 mb-4 animate-pulse" />
      <p className="text-xs uppercase font-bold tracking-widest text-neutral-400 mb-2">
        The leaderboard is waiting for its first verified startup.
      </p>
      <p className="text-xs text-neutral-500 font-medium max-w-sm leading-relaxed">
        You&apos;re early. Verify your startup by connecting Stripe or Razorpay, publish your verified revenue, and become the first company to earn a place on Verifii&apos;s public leaderboard.
      </p>
      <p className="text-[10px] text-neutral-600 font-medium mt-4 max-w-xs leading-relaxed">
        Every company on this leaderboard is verified through live payment provider data. No self-reported revenue is ever published.
      </p>
      <Link
        href="/submit"
        className="mt-6 px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg"
      >
        Verify your startup
      </Link>
    </div>
  );
}
