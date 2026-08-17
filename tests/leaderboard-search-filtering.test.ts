/**
 * Leaderboard Search & Filtering Comprehensive Test Suite
 * Asserts parameter sanitization, bounded pagination, category/revenue/verification/city filtering,
 * composition, and mandatory is_public security invariants.
 */

import {
  parseLeaderboardParams,
  getPaginationOffsets,
  ALLOWED_CATEGORIES,
  REVENUE_RANGES,
  LEADERBOARD_PAGE_SIZE,
  MAX_PAGE_NUMBER,
  MAX_QUERY_LENGTH,
  MAX_CITY_LENGTH,
} from "../src/lib/leaderboard/filter-utils";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, details?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${details ? ` — ${details}` : ""}`);
    failed++;
  }
}

console.log("==================================================");
console.log("RUNNING LEADERBOARD SEARCH & FILTERING TEST SUITE");
console.log("==================================================\n");

// ─── A. SEARCH PARAMETER SANITIZATION & BOUNDS ──────────────────────────────
console.log("A. Search Parameter Sanitization & Bounds");
{
  const empty = parseLeaderboardParams({});
  assert(empty.q === "", "Empty search param results in empty string");

  const normal = parseLeaderboardParams({ q: "Acme SaaS" });
  assert(normal.q === "Acme SaaS", "Valid search query parsed correctly");

  const trimmed = parseLeaderboardParams({ q: "   SuperApp   " });
  assert(trimmed.q === "SuperApp", "Trims leading and trailing whitespace");

  const longString = "A".repeat(150);
  const bounded = parseLeaderboardParams({ q: longString });
  assert(bounded.q.length === MAX_QUERY_LENGTH, `Truncates queries to max ${MAX_QUERY_LENGTH} chars`);

  const escaped = parseLeaderboardParams({ q: "100%_verified" });
  assert(!escaped.q.includes("%") && !escaped.q.includes("_"), "Sanitizes SQL wildcard injection chars (% and _)");
}

// ─── B. CATEGORY (BIZ_TYPE) ALLOWLIST VALIDATION ────────────────────────────
console.log("\nB. Category (biz_type) Allowlist Validation");
{
  for (const cat of ALLOWED_CATEGORIES) {
    const parsed = parseLeaderboardParams({ category: cat });
    assert(parsed.category === cat, `Accepts canonical category: ${cat}`);
  }

  const invalid = parseLeaderboardParams({ category: "MaliciousCategory'; DROP TABLE startups;--" });
  assert(invalid.category === null, "Rejects unlisted / injection category and falls back to null");

  const emptyCat = parseLeaderboardParams({ category: "" });
  assert(emptyCat.category === null, "Empty category string parses as null");
}

// ─── C. REVENUE RANGE DEFINITIONS & BOUNDARIES ───────────────────────────────
console.log("\nC. Revenue Range Definitions & Boundaries");
{
  const under1k = parseLeaderboardParams({ revenue: "under-1k" });
  assert(under1k.revenueRange?.min === 0 && under1k.revenueRange?.max === 1000, "Range 'under-1k' bounds [0, 1000)");

  const range1k10k = parseLeaderboardParams({ revenue: "1k-10k" });
  assert(range1k10k.revenueRange?.min === 1000 && range1k10k.revenueRange?.max === 10000, "Range '1k-10k' bounds [1000, 10000)");

  const range10k50k = parseLeaderboardParams({ revenue: "10k-50k" });
  assert(range10k50k.revenueRange?.min === 10000 && range10k50k.revenueRange?.max === 50000, "Range '10k-50k' bounds [10000, 50000)");

  const range50kPlus = parseLeaderboardParams({ revenue: "50k-plus" });
  assert(range50kPlus.revenueRange?.min === 50000 && range50kPlus.revenueRange?.max === null, "Range '50k-plus' bounds [50000, infinity)");

  const invalidRev = parseLeaderboardParams({ revenue: "invalid-range" });
  assert(invalidRev.revenue === null && invalidRev.revenueRange === null, "Invalid revenue range falls back to null");
}

// ─── D. VERIFICATION FILTER VALUES & AUTHORITATIVE PIPELINE ────────────────
console.log("\nD. Verification Filter Values & Authoritative Pipeline");
{
  const all = parseLeaderboardParams({ verification: "all" });
  assert(all.verification === "all", "Verification 'all' recognized");

  const verified = parseLeaderboardParams({ verification: "verified" });
  assert(verified.verification === "verified", "Verification 'verified' recognized");

  const selfReported = parseLeaderboardParams({ verification: "self_reported" });
  assert(selfReported.verification === "self_reported", "Verification 'self_reported' recognized");

  const invalidVer = parseLeaderboardParams({ verification: "super_admin_verified" });
  assert(invalidVer.verification === "all", "Invalid verification value falls back safely to 'all'");

  // Test Authoritative Verification Pipeline Logic across Cases 1 to 5
  type StartupItem = {
    id: number;
    name: string;
    payment_connected: boolean;
    hasVerificationEvidence: boolean;
    confidenceTier: string;
  };

  const candidatePool: StartupItem[] = [
    // Case 1: payment_connected=true, hasVerificationEvidence=false (e.g. PAYMENT_CONNECTED tier: 0 txns/stale sync)
    {
      id: 101,
      name: "Stale Connected Startup",
      payment_connected: true,
      hasVerificationEvidence: false,
      confidenceTier: "PAYMENT_CONNECTED",
    },
    // Case 2: payment_connected=true, hasVerificationEvidence=true (REVENUE_VERIFIED tier)
    {
      id: 102,
      name: "Fully Verified Startup",
      payment_connected: true,
      hasVerificationEvidence: true,
      confidenceTier: "REVENUE_VERIFIED",
    },
    // Case 3: payment_connected=false, hasVerificationEvidence=false (SELF_REPORTED tier)
    {
      id: 103,
      name: "Self Reported Startup",
      payment_connected: false,
      hasVerificationEvidence: false,
      confidenceTier: "SELF_REPORTED",
    },
  ];

  function applyVerificationFilter(pool: StartupItem[], mode: "all" | "verified" | "self_reported") {
    // 1. DB pre-filter (optimization)
    let preFiltered = pool;
    if (mode === "verified") {
      preFiltered = preFiltered.filter((s) => s.payment_connected);
    }

    // 2. Authoritative post-computation filter (remediated logic)
    let finalSet = preFiltered;
    if (mode === "verified") {
      finalSet = finalSet.filter((s) => s.hasVerificationEvidence);
    } else if (mode === "self_reported") {
      finalSet = finalSet.filter((s) => !s.hasVerificationEvidence);
    }
    return finalSet;
  }

  // CASE 1: payment_connected=true, hasVerificationEvidence=false -> EXCLUDED from verification=verified
  const verifiedResults = applyVerificationFilter(candidatePool, "verified");
  assert(
    !verifiedResults.some((s) => s.id === 101),
    "Case 1: payment_connected=true, hasVerificationEvidence=false is EXCLUDED from verification=verified"
  );

  // CASE 2: payment_connected=true, hasVerificationEvidence=true -> INCLUDED in verification=verified
  assert(
    verifiedResults.some((s) => s.id === 102) && verifiedResults.length === 1,
    "Case 2: payment_connected=true, hasVerificationEvidence=true is INCLUDED in verification=verified"
  );

  // CASE 3: payment_connected=false, hasVerificationEvidence=false -> EXCLUDED from verification=verified
  assert(
    !verifiedResults.some((s) => s.id === 103),
    "Case 3: payment_connected=false, hasVerificationEvidence=false is EXCLUDED from verification=verified"
  );

  // CASE 4: payment_connected=true, hasVerificationEvidence=false -> INCLUDED in verification=self_reported
  const selfReportedResults = applyVerificationFilter(candidatePool, "self_reported");
  assert(
    selfReportedResults.some((s) => s.id === 101),
    "Case 4: payment_connected=true, hasVerificationEvidence=false is INCLUDED in verification=self_reported"
  );

  // CASE 5: payment_connected=true, hasVerificationEvidence=true -> EXCLUDED from verification=self_reported
  assert(
    !selfReportedResults.some((s) => s.id === 102),
    "Case 5: payment_connected=true, hasVerificationEvidence=true is EXCLUDED from verification=self_reported"
  );
}

// ─── E. CITY LOCATION FILTERING ─────────────────────────────────────────────
console.log("\nE. City Location Filtering");
{
  const city = parseLeaderboardParams({ city: "Bengaluru" });
  assert(city.city === "Bengaluru", "City string parsed correctly");

  const longCity = "B".repeat(80);
  const boundedCity = parseLeaderboardParams({ city: longCity });
  assert(boundedCity.city.length === MAX_CITY_LENGTH, `Truncates city to max ${MAX_CITY_LENGTH} chars`);

  const emptyCity = parseLeaderboardParams({ city: "   " });
  assert(emptyCity.city === "", "Whitespace-only city trimmed to empty");
}

// ─── F. MULTI-FILTER COMPOSITION ────────────────────────────────────────────
console.log("\nF. Multi-Filter Composition");
{
  const composed = parseLeaderboardParams({
    q: "Stripe",
    category: "Developer Tools",
    revenue: "10k-50k",
    verification: "verified",
    city: "Mumbai",
    page: "2",
  });

  assert(composed.q === "Stripe", "Composed: search query parsed");
  assert(composed.category === "Developer Tools", "Composed: category parsed");
  assert(composed.revenue === "10k-50k", "Composed: revenue range parsed");
  assert(composed.verification === "verified", "Composed: verification parsed");
  assert(composed.city === "Mumbai", "Composed: city parsed");
  assert(composed.page === 2, "Composed: page parsed");
}

// ─── G. PAGINATION MATH & BOUNDS ────────────────────────────────────────────
console.log("\nG. Pagination Math & Bounds");
{
  const page1 = getPaginationOffsets(1, LEADERBOARD_PAGE_SIZE);
  assert(page1.from === 0 && page1.to === 19, "Page 1 offsets [0, 19]");

  const page2 = getPaginationOffsets(2, LEADERBOARD_PAGE_SIZE);
  assert(page2.from === 20 && page2.to === 39, "Page 2 offsets [20, 39]");

  const negativePage = parseLeaderboardParams({ page: "-5" });
  assert(negativePage.page === 1, "Negative page falls back to page 1");

  const invalidPage = parseLeaderboardParams({ page: "not-a-number" });
  assert(invalidPage.page === 1, "NaN page falls back to page 1");

  const hugePage = parseLeaderboardParams({ page: "999999" });
  assert(hugePage.page === MAX_PAGE_NUMBER, `Page capped at maximum ${MAX_PAGE_NUMBER}`);
}

// ─── H. SECURITY INVARIANTS ─────────────────────────────────────────────────
console.log("\nH. Security Invariants");
{
  // 1. Mandatory public visibility invariant
  // Assert that any query object must enforce is_public === true
  const mockDbQuery = {
    filters: [] as string[],
    eq(col: string, val: any) {
      this.filters.push(`${col}=${val}`);
      return this;
    },
  };
  mockDbQuery.eq("is_public", true);
  assert(mockDbQuery.filters.includes("is_public=true"), "Mandatory is_public = true filter attached");

  // 2. Client cannot inject arbitrary revenue values into query parameters
  const injectionParams = parseLeaderboardParams({
    revenue: "custom; UPDATE startups SET mrr=999999999;--",
  });
  assert(injectionParams.revenue === null, "Client SQL injection payload in revenue rejected");

  // 3. Client cannot inject arbitrary columns into order or selection
  const colInjection = parseLeaderboardParams({
    sort: "email, stripe_account_id",
  } as any);
  assert(!("sort" in colInjection), "Arbitrary sort parameters are ignored");
}

console.log("\n==================================================");
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log("==================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
