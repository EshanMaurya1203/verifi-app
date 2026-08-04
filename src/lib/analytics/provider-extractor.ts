import { isProviderFilter, type ProviderFilter } from "./filters";

/**
 * Safely extracts payment provider name from an event record's metadata.
 * Returns null if event metadata does not contain a recognized provider ("stripe" or "razorpay").
 */
export function extractProvider(record: { metadata?: Record<string, unknown> | null }): ProviderFilter | null {
  if (!record || !record.metadata || typeof record.metadata !== "object") {
    return null;
  }

  const provider = record.metadata.provider;
  if (typeof provider === "string" && isProviderFilter(provider) && provider !== "all") {
    return provider;
  }

  return null;
}
