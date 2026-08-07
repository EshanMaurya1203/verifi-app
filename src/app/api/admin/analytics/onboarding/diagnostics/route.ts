import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOnboardingEvents } from "@/lib/analytics/events";
import { applyAnalyticsFilters } from "@/lib/analytics/filter-engine";
import { normalizeFilters } from "@/lib/analytics/filters";
import { buildFounderJourneys } from "@/lib/analytics/journey-builder";
import {
  buildDiagnosticsReport,
  findDropOffPoints,
  findSlowSteps,
  findStuckFounders,
  DiagnosticsReport,
  DropOffPoint,
  StepDuration,
} from "@/lib/analytics/diagnostics";
import { FounderJourney } from "@/lib/analytics/journey";
import {
  getCacheKey,
  getCachedValue,
  setCachedValue,
  DIAGNOSTICS_TTL_MS,
} from "@/lib/analytics/cache";
import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Response Payload Interface ───────────────────────────────────────
export interface DiagnosticsResponse {
  readonly summary: {
    readonly generatedAt: string;
    readonly range: TimeRange;
    readonly filters: AnalyticsFilters;
  };
  readonly diagnostics: DiagnosticsReport;
  readonly dropOffs: readonly DropOffPoint[];
  readonly slowSteps: readonly StepDuration[];
  readonly stuckFounders: readonly FounderJourney[];
}

// ─── Constants ────────────────────────────────────────────────────────
const VALID_RANGES = ["24h", "7d", "30d", "all"] as const;
const DEFAULT_RANGE: TimeRange = "7d";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-diagnostics";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify admin access
    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Validate query parameters
    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("range");
    const range = validateRange(rawRange);

    if (range === null) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    const providerParam = searchParams.get("provider");
    const outcomeParam = searchParams.get("outcome");
    const filters = normalizeFilters(providerParam, outcomeParam);

    // 4. Rate limiting
    const rateLimitKey = `${RATE_LIMIT_KEY_PREFIX}:${user.id}`;
    const { allowed } = await checkRateLimit(rateLimitKey, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, { failOpen: true });

    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 5. In-memory cache check
    const cacheKey = getCacheKey("diagnostics", range, filters);
    const cachedResponse = getCachedValue<DiagnosticsResponse>(cacheKey);

    if (cachedResponse) {
      return NextResponse.json(cachedResponse, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cache": "HIT",
          "X-Cache-TTL": String(DIAGNOSTICS_TTL_MS / 1000),
        },
      });
    }

    // 6. Execute pipeline: Fetch -> Filter -> Build Journeys -> Diagnostics
    const rawEvents = await fetchOnboardingEvents(range);
    const filteredEvents = applyAnalyticsFilters(rawEvents, filters);
    const journeys = buildFounderJourneys(filteredEvents);

    const diagnostics = buildDiagnosticsReport(journeys);
    const dropOffs = findDropOffPoints(journeys);
    const slowSteps = findSlowSteps(journeys);
    const stuckFounders = findStuckFounders(journeys);

    const response: DiagnosticsResponse = {
      summary: {
        generatedAt: new Date().toISOString(),
        range,
        filters,
      },
      diagnostics,
      dropOffs,
      slowSteps,
      stuckFounders,
    };

    // 7. Store in cache
    setCachedValue(cacheKey, response, DIAGNOSTICS_TTL_MS);

    // 8. Return response
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Cache": "MISS",
        "X-Cache-TTL": String(DIAGNOSTICS_TTL_MS / 1000),
      },
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding/diagnostics] Internal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
