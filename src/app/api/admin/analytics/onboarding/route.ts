import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAnalyticsReport } from "@/lib/analytics/metrics";
import { fetchOnboardingEvents } from "@/lib/analytics/events";
import { applyAnalyticsFilters } from "@/lib/analytics/filter-engine";
import { normalizeFilters } from "@/lib/analytics/filters";
import {
  getCacheKey,
  getCachedValue,
  setCachedValue,
  ANALYTICS_TTL_MS,
} from "@/lib/analytics/cache";
import type { TimeRange, OnboardingMetricsReport } from "@/lib/analytics/types";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────

const VALID_TIME_RANGES = ["24h", "7d", "30d", "all"] as const;
const DEFAULT_TIME_RANGE: TimeRange = "7d";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-onboarding";

// ─── Validation ───────────────────────────────────────────────────────

function isTimeRange(value: string): value is TimeRange {
  return (VALID_TIME_RANGES as readonly string[]).includes(value);
}

function validateTimeRange(value: string | null): TimeRange | null {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_TIME_RANGE;
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
    const range = validateTimeRange(rawRange);

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
    const { allowed } = checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // 5. Check in-memory cache
    const cacheKey = getCacheKey("analytics", range, filters);
    const cachedReport = getCachedValue<OnboardingMetricsReport>(cacheKey);

    if (cachedReport) {
      return NextResponse.json(cachedReport, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cache": "HIT",
          "X-Cache-TTL": String(ANALYTICS_TTL_MS / 1000),
        },
      });
    }

    // 6. Execute pipeline: Fetch -> Filter -> Build Report
    const rawEvents = await fetchOnboardingEvents(range);
    const filteredEvents = applyAnalyticsFilters(rawEvents, filters);
    const report = await buildAnalyticsReport(filteredEvents, range, filters);

    // 7. Store in cache
    setCachedValue(cacheKey, report, ANALYTICS_TTL_MS);

    // 8. Return JSON response
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Cache": "MISS",
        "X-Cache-TTL": String(ANALYTICS_TTL_MS / 1000),
      },
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding] Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
