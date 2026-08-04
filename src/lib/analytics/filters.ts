import type { TimeRange } from "./types";

export type ProviderFilter = "all" | "stripe" | "razorpay";

export type OutcomeFilter = "all" | "completed" | "abandoned" | "failed";

export interface AnalyticsFilters {
  readonly provider: ProviderFilter;
  readonly outcome: OutcomeFilter;
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  provider: "all",
  outcome: "all",
};

export const VALID_PROVIDER_FILTERS = ["all", "stripe", "razorpay"] as const;
export const VALID_OUTCOME_FILTERS = ["all", "completed", "abandoned", "failed"] as const;

export function isProviderFilter(value: string): value is ProviderFilter {
  return (VALID_PROVIDER_FILTERS as readonly string[]).includes(value);
}

export function isOutcomeFilter(value: string): value is OutcomeFilter {
  return (VALID_OUTCOME_FILTERS as readonly string[]).includes(value);
}

export function normalizeFilters(
  provider?: string | null,
  outcome?: string | null
): AnalyticsFilters {
  const normProvider = provider && isProviderFilter(provider) ? provider : "all";
  const normOutcome = outcome && isOutcomeFilter(outcome) ? outcome : "all";

  return {
    provider: normProvider,
    outcome: normOutcome,
  };
}
