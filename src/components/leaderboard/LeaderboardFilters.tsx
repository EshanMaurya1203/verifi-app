"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Filter, RotateCcw } from "lucide-react";
import {
  ALLOWED_CATEGORIES,
  REVENUE_RANGES,
  VERIFICATION_OPTIONS,
  ParsedLeaderboardParams,
} from "@/lib/leaderboard/filter-utils";

interface LeaderboardFiltersProps {
  initialParams: ParsedLeaderboardParams;
  totalCount: number;
}

export function LeaderboardFilters({
  initialParams,
  totalCount,
}: LeaderboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialParams.q);
  const [category, setCategory] = useState(initialParams.category || "");
  const [revenue, setRevenue] = useState(initialParams.revenue || "");
  const [verification, setVerification] = useState(initialParams.verification || "all");
  const [city, setCity] = useState(initialParams.city);

  // Sync state when URL changes
  useEffect(() => {
    setQ(initialParams.q);
    setCategory(initialParams.category || "");
    setRevenue(initialParams.revenue || "");
    setVerification(initialParams.verification || "all");
    setCity(initialParams.city);
  }, [initialParams]);

  const updateFilters = (updates: Partial<{
    q: string;
    category: string;
    revenue: string;
    verification: string;
    city: string;
  }>) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");

    const newQ = updates.q !== undefined ? updates.q : q;
    const newCat = updates.category !== undefined ? updates.category : category;
    const newRev = updates.revenue !== undefined ? updates.revenue : revenue;
    const newVer = updates.verification !== undefined ? updates.verification : verification;
    const newCity = updates.city !== undefined ? updates.city : city;

    if (newQ.trim()) params.set("q", newQ.trim());
    else params.delete("q");

    if (newCat) params.set("category", newCat);
    else params.delete("category");

    if (newRev) params.set("revenue", newRev);
    else params.delete("revenue");

    if (newVer && newVer !== "all") params.set("verification", newVer);
    else params.delete("verification");

    if (newCity.trim()) params.set("city", newCity.trim());
    else params.delete("city");

    // Reset pagination to page 1 whenever filters change
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q });
  };

  const handleClearFilters = () => {
    setQ("");
    setCategory("");
    setRevenue("");
    setVerification("all");
    setCity("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  const activeFilterCount = [
    Boolean(q),
    Boolean(category),
    Boolean(revenue),
    verification !== "all",
    Boolean(city),
  ].filter(Boolean).length;

  return (
    <div className="bg-[#09090b]/50 border border-white/[0.08] rounded-3xl p-5 md:p-6 mb-8 shadow-xl backdrop-blur-md">
      {/* Top row: Search and active count */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search startup by company name..."
            className="w-full bg-[#121216] border border-white/[0.08] rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                updateFilters({ q: "" });
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative md:w-56">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => updateFilters({ city })}
            placeholder="Filter by city (e.g. Bengaluru)"
            className="w-full bg-[#121216] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {city && (
            <button
              type="button"
              onClick={() => {
                setCity("");
                updateFilters({ city: "" });
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Bottom row: Dropdowns & Clear Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/[0.04]">
        {/* Category Filter */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value;
              setCategory(val);
              updateFilters({ category: val });
            }}
            className="w-full bg-[#121216] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-primary/50"
          >
            <option value="">All Categories</option>
            {ALLOWED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Revenue Range Filter */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
            Monthly Revenue
          </label>
          <select
            value={revenue}
            onChange={(e) => {
              const val = e.target.value;
              setRevenue(val);
              updateFilters({ revenue: val });
            }}
            className="w-full bg-[#121216] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-primary/50"
          >
            <option value="">All Revenue Ranges</option>
            {Object.values(REVENUE_RANGES).map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Verification Filter */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
            Verification
          </label>
          <select
            value={verification}
            onChange={(e) => {
              const val = e.target.value;
              setVerification(val as any);
              updateFilters({ verification: val });
            }}
            className="w-full bg-[#121216] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-primary/50"
          >
            {VERIFICATION_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions / Reset */}
        <div className="flex items-end">
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              Reset ({activeFilterCount})
            </button>
          ) : (
            <div className="w-full py-2 px-3 text-center text-[11px] text-neutral-500 font-medium">
              {totalCount} {totalCount === 1 ? "startup" : "startups"} indexed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
