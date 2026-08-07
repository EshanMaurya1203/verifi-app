import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildComparisonReport, ComparisonReport, getComparisonWindow } from "@/lib/analytics/comparison";
import { fetchOnboardingEventsForWindow } from "@/lib/analytics/events";
import { applyAnalyticsFilters } from "@/lib/analytics/filter-engine";
import { normalizeFilters } from "@/lib/analytics/filters";
import {
  getCacheKey,
  getCachedValue,
  setCachedValue,
  COMPARISON_TTL_MS,
} from "@/lib/analytics/cache";
import type { TimeRange } from "@/lib/analytics/types";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────

const VALID_RANGES = ["24h", "7d", "30d", "all"] as const;
const DEFAULT_RANGE: TimeRange = "7d";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-comparison";

// ─── Validation ───────────────────────────────────────────────────────

function isTimeRange(value: string): value is TimeRange {
  return (VALID_RANGES as readonly string[]).includes(value);
}

function validateRange(value: string | null): TimeRange | null {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_RANGE;
  }

  if (isTimeRange(value)) {
    return value;
  }

  return null;
}

// ─── GET Handler ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Verify admin access
    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // 3. Validate parameters
    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("range");
    const range = validateRange(rawRange);

    if (range === null) {
      return NextResponse.json(
        { error: "Invalid time range" },
        { status: 400 }
      );
    }

    const providerParam = searchParams.get("provider");
    const outcomeParam = searchParams.get("outcome");
    const filters = normalizeFilters(providerParam, outcomeParam);

    // 4. Per-user rate limiting
    const rateLimitKey = `${RATE_LIMIT_KEY_PREFIX}:${user.id}`;
    const { allowed } = await checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS,
      { failOpen: true }
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // 5. Check in-memory cache
    const cacheKey = getCacheKey("comparison", range, filters);
    const cachedComparison = getCachedValue<ComparisonReport>(cacheKey);

    if (cachedComparison) {
      return NextResponse.json(cachedComparison, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cache": "HIT",
          "X-Cache-TTL": String(COMPARISON_TTL_MS / 1000),
        },
      });
    }

    // 6. Execute pipeline: Fetch windows -> Filter both -> Build Comparison
    let report: ComparisonReport;
    const windows = getComparisonWindow(range);

    if (!windows) {
      report = await buildComparisonReport([], [], range);
    } else {
      const [rawCurrent, rawPrevious] = await Promise.all([
        fetchOnboardingEventsForWindow(windows.current),
        fetchOnboardingEventsForWindow(windows.previous),
      ]);
      const currentFiltered = applyAnalyticsFilters(rawCurrent, filters);
      const previousFiltered = applyAnalyticsFilters(rawPrevious, filters);
      report = await buildComparisonReport(currentFiltered, previousFiltered, range);
    }

    // 7. Store in cache
    setCachedValue(cacheKey, report, COMPARISON_TTL_MS);

    // 8. Return JSON response with no-store caching headers
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Cache": "MISS",
        "X-Cache-TTL": String(COMPARISON_TTL_MS / 1000),
      },
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding/comparison] Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
