/**
 * Centralized, Premium Reusable Numeric Formatting Utilities for Verifi
 */

/**
 * Format any float/percentage value to consistent decimal precision.
 * E.g., 2.856408168513082 -> "2.86%"
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format growth rate, prepending a plus/minus sign automatically.
 * E.g., 12.3456 -> "+12.35%", -2.8564 -> "-2.86%"
 */
export function formatGrowth(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Formats scores (Trust scores, Confidence scores, etc.) with consistent precision.
 * E.g., 85.342 -> "85" (or "85.3" if specified)
 */
export function formatScore(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return value.toFixed(decimals);
}

/**
 * Format a ranking number to a human-readable rank format (e.g., 1 -> "#1").
 */
export function formatRank(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `#${value}`;
}

/**
 * Format a number to a human-readable ordinal format (e.g., 1 -> "1st", 2 -> "2nd").
 */
export function formatOrdinal(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = value % 100;
  return value + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Formats a currency value consistently.
 * Supports INR (Indian Rupee with Lakh/Crore grouping and naming)
 * and USD (US Dollar with standard millions/billions/thousands grouping).
 */
export function formatCurrency(
  value: number,
  currency: string = "INR",
  options: { compact?: boolean; precision?: number } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return currency.toUpperCase() === "USD" ? "$0" : "₹0";
  }

  const curr = currency.toUpperCase();
  const symbol = curr === "USD" ? "$" : "₹";
  const compact = options.compact ?? true;
  const precision = options.precision ?? 1;

  if (!compact) {
    if (curr === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    } else {
      // Indian standard grouping for INR (e.g., ₹1,50,000)
      return symbol + new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
      }).format(value);
    }
  }

  // Compact Currency Formats
  if (curr === "USD") {
    if (value >= 1_000_000_000) {
      return `${symbol}${(value / 1_000_000_000).toFixed(precision)}B`;
    }
    if (value >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(precision)}M`;
    }
    if (value >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(precision === 1 ? 0 : precision)}k`;
    }
    return `${symbol}${value.toFixed(0)}`;
  } else {
    // INR Standard Formatting
    if (value >= 10_000_000) {
      return `${symbol}${(value / 10_000_000).toFixed(precision)}Cr`;
    }
    if (value >= 100_000) {
      return `${symbol}${(value / 100_000).toFixed(precision)}L`;
    }
    if (value >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(precision === 1 ? 0 : precision)}k`;
    }
    return `${symbol}${value.toFixed(0)}`;
  }
}
