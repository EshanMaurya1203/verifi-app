"use client";

import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters, ProviderFilter, OutcomeFilter } from "@/lib/analytics/filters";

interface FilterBarProps {
  readonly range: TimeRange;
  readonly filters: AnalyticsFilters;
  readonly onRangeChange: (range: TimeRange) => void;
  readonly onFiltersChange: (filters: AnalyticsFilters) => void;
  readonly disabled?: boolean;
}

const RANGES: readonly { readonly label: string; readonly value: TimeRange }[] = [
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" },
];

const PROVIDERS: readonly { readonly label: string; readonly value: ProviderFilter }[] = [
  { label: "All Providers", value: "all" },
  { label: "Stripe", value: "stripe" },
  { label: "Razorpay", value: "razorpay" },
];

const OUTCOMES: readonly { readonly label: string; readonly value: OutcomeFilter }[] = [
  { label: "All Outcomes", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Abandoned", value: "abandoned" },
  { label: "Failed", value: "failed" },
];

export function FilterBar({
  range,
  filters,
  onRangeChange,
  onFiltersChange,
  disabled = false,
}: FilterBarProps) {
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      provider: e.target.value as ProviderFilter,
    });
  };

  const handleOutcomeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      outcome: e.target.value as OutcomeFilter,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Range Selector Buttons */}
      <div className="flex items-center space-x-1 rounded-lg border border-white/10 bg-[#161616] p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              range === r.value
                ? "bg-white/10 text-white shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Provider Filter Dropdown */}
      <div className="relative">
        <select
          value={filters.provider}
          onChange={handleProviderChange}
          disabled={disabled}
          className="appearance-none rounded-lg border border-white/10 bg-[#161616] py-1.5 pl-3 pr-8 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/5 focus:border-white/20 focus:outline-none disabled:opacity-50"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value} className="bg-[#161616] text-white">
              {p.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
          ▼
        </span>
      </div>

      {/* Outcome Filter Dropdown */}
      <div className="relative">
        <select
          value={filters.outcome}
          onChange={handleOutcomeChange}
          disabled={disabled}
          className="appearance-none rounded-lg border border-white/10 bg-[#161616] py-1.5 pl-3 pr-8 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/5 focus:border-white/20 focus:outline-none disabled:opacity-50"
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#161616] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
          ▼
        </span>
      </div>
    </div>
  );
}
