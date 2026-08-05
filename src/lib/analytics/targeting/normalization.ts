// ─── VRF-ONBOARD-003B.1 / 003B.2 — Targeting Normalization Module ──────────

import type { ProviderType } from "./targeting-types";
import { InvalidTargetingRuleError } from "./targeting-errors";

export const ALLOWED_PROVIDERS = [
  "stripe",
  "razorpay",
] as const;

/**
 * Collapses multiple spaces, trims whitespace, and converts to lowercase.
 */
function normalizeString(value: string): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Normalizes a country code.
 * Example: " US " → "us", "Us" → "us"
 */
export function normalizeCountry(value: string): string {
  return normalizeString(value);
}

/**
 * Normalizes an acquisition source string.
 * Example: "  Google Ads  " → "google ads"
 */
export function normalizeAcquisitionSource(value: string): string {
  return normalizeString(value);
}

/**
 * Normalizes and validates a payment provider string against ALLOWED_PROVIDERS.
 * Example: "STRIPE" → "stripe", " RazorPay " → "razorpay"
 * Throws InvalidTargetingRuleError for unknown providers (e.g. "paypal", "square").
 */
export function normalizeProvider(value: string): ProviderType {
  const normalized = normalizeString(value);
  if (!ALLOWED_PROVIDERS.includes(normalized as ProviderType)) {
    throw new InvalidTargetingRuleError(`Unknown provider: ${value}`);
  }
  return normalized as ProviderType;
}
