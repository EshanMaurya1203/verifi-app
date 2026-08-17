/**
 * Leaderboard Search & Filtering Utilities
 * Authoritative constants, parameter parsers, and validation helpers.
 */

export const ALLOWED_CATEGORIES = [
  "SaaS/Software",
  "Artificial Intelligence",
  "Mobile App",
  "D2C/E-commerce",
  "Content/Creator",
  "Agency/Services",
  "Developer Tools",
  "Marketing Tools",
] as const;

export type CategoryOption = (typeof ALLOWED_CATEGORIES)[number];

export interface RevenueRangeDef {
  id: string;
  label: string;
  min: number;
  max: number | null; // null means no upper bound
}

export const REVENUE_RANGES: Record<string, RevenueRangeDef> = {
  "under-1k": {
    id: "under-1k",
    label: "< ₹1,000",
    min: 0,
    max: 1000,
  },
  "1k-10k": {
    id: "1k-10k",
    label: "₹1,000 – ₹9,999",
    min: 1000,
    max: 10000,
  },
  "10k-50k": {
    id: "10k-50k",
    label: "₹10,000 – ₹49,999",
    min: 10000,
    max: 50000,
  },
  "50k-plus": {
    id: "50k-plus",
    label: "₹50,000+",
    min: 50000,
    max: null,
  },
};

export const VERIFICATION_OPTIONS = [
  { id: "all", label: "All Statuses" },
  { id: "verified", label: "Payment Verified" },
  { id: "self_reported", label: "Self-Reported" },
] as const;

export type VerificationFilterOption = "all" | "verified" | "self_reported";

export interface ParsedLeaderboardParams {
  q: string;
  category: CategoryOption | null;
  revenue: string | null;
  revenueRange: RevenueRangeDef | null;
  verification: VerificationFilterOption;
  city: string;
  page: number;
  pageSize: number;
}

export const LEADERBOARD_PAGE_SIZE = 20;
export const MAX_PAGE_NUMBER = 100;
export const MAX_QUERY_LENGTH = 100;
export const MAX_CITY_LENGTH = 50;

/**
 * Sanitizes and strictly validates untrusted URL search parameters for the leaderboard.
 */
export function parseLeaderboardParams(
  rawParams?: Record<string, string | string[] | undefined> | null
): ParsedLeaderboardParams {
  if (!rawParams) {
    return {
      q: "",
      category: null,
      revenue: null,
      revenueRange: null,
      verification: "all",
      city: "",
      page: 1,
      pageSize: LEADERBOARD_PAGE_SIZE,
    };
  }

  // 1. Search Query (startup_name only, trimmed, max 100 chars, remove dangerous control chars)
  const rawQ = Array.isArray(rawParams.q) ? rawParams.q[0] : rawParams.q;
  const q = typeof rawQ === "string"
    ? rawQ.trim().slice(0, MAX_QUERY_LENGTH).replace(/[%_]/g, " ") // escape wildcard injections
    : "";

  // 2. Category (biz_type, strict allowlist match)
  const rawCat = Array.isArray(rawParams.category) ? rawParams.category[0] : rawParams.category;
  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(rawCat || "")
    ? (rawCat as CategoryOption)
    : null;

  // 3. Revenue Range (mrr, strict key match in REVENUE_RANGES)
  const rawRev = Array.isArray(rawParams.revenue) ? rawParams.revenue[0] : rawParams.revenue;
  const revenueRange = rawRev && REVENUE_RANGES[rawRev] ? REVENUE_RANGES[rawRev] : null;
  const revenue = revenueRange ? revenueRange.id : null;

  // 4. Verification Option
  const rawVer = Array.isArray(rawParams.verification) ? rawParams.verification[0] : rawParams.verification;
  const verification: VerificationFilterOption =
    rawVer === "verified" || rawVer === "self_reported" ? rawVer : "all";

  // 5. City Location (trimmed, max 50 chars)
  const rawCity = Array.isArray(rawParams.city) ? rawParams.city[0] : rawParams.city;
  const city = typeof rawCity === "string"
    ? rawCity.trim().slice(0, MAX_CITY_LENGTH).replace(/[%_]/g, " ")
    : "";

  // 6. Page Number (positive integer, bounded between 1 and MAX_PAGE_NUMBER)
  const rawPage = Array.isArray(rawParams.page) ? rawParams.page[0] : rawParams.page;
  let page = parseInt(rawPage || "1", 10);
  if (isNaN(page) || page < 1) page = 1;
  if (page > MAX_PAGE_NUMBER) page = MAX_PAGE_NUMBER;

  return {
    q,
    category,
    revenue,
    revenueRange,
    verification,
    city,
    page,
    pageSize: LEADERBOARD_PAGE_SIZE,
  };
}

/**
 * Calculates zero-indexed database query range [from, to] for Supabase .range().
 */
export function getPaginationOffsets(page: number, pageSize: number = LEADERBOARD_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to, pageSize };
}
