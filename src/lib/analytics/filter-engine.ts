import { extractProvider } from "./provider-extractor";
import { classifyOutcome } from "./outcome-classifier";
import type { AnalyticsFilters, ProviderFilter, OutcomeFilter } from "./filters";

export interface EventRecord {
  event_name: string;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

/**
 * Filters records by provider filter using extractProvider().
 */
export function applyProviderFilter<T extends EventRecord>(
  records: T[],
  provider: ProviderFilter
): T[] {
  if (provider === "all") {
    return records;
  }

  return records.filter((record) => extractProvider(record) === provider);
}

/**
 * Filters records by outcome filter using classifyOutcome().
 */
export function applyOutcomeFilter<T extends EventRecord>(
  records: T[],
  outcome: OutcomeFilter
): T[] {
  if (outcome === "all") {
    return records;
  }

  return records.filter((record) => classifyOutcome(record.event_name) === outcome);
}

/**
 * Pure orchestrator that applies provider and outcome filters sequentially.
 * Does NOT inspect event names or metadata directly.
 */
export function applyAnalyticsFilters<T extends EventRecord>(
  records: T[],
  filters: AnalyticsFilters
): T[] {
  const providerFiltered = applyProviderFilter(records, filters.provider);
  return applyOutcomeFilter(providerFiltered, filters.outcome);
}
