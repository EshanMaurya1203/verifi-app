import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOnboardingEvents } from "@/lib/analytics/events";
import { applyAnalyticsFilters } from "@/lib/analytics/filter-engine";
import { normalizeFilters } from "@/lib/analytics/filters";
import { buildFounderJourneys } from "@/lib/analytics/journey-builder";
import { buildDiagnosticsReport } from "@/lib/analytics/diagnostics";
import { buildFounderRecoveries } from "@/lib/analytics/recovery-engine";
import { buildRecoveryReport } from "@/lib/analytics/recovery-metrics";
import {
  buildProviderMetricsFromEvents,
  buildRiskSignalsFromJourneys,
} from "@/lib/analytics/export";
import { buildRecommendations } from "@/lib/analytics/recommendation-engine";
import {
  getCacheKey,
  getCachedValue,
  setCachedValue,
  RECOMMENDATION_TTL_MS,
} from "@/lib/analytics/cache";
import type { TimeRange } from "@/lib/analytics/types";
import type { Recommendation } from "@/lib/analytics/recommendations";
import type { RiskSignal } from "@/lib/analytics/risk-scoring";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Response Payload Interface ───────────────────────────────────────
export interface RecommendationsResponse {
  readonly summary: {
    readonly generatedAt: string;
  };
  readonly warnings: readonly Recommendation[];
  readonly insights: readonly Recommendation[];
  readonly riskSignals: readonly RiskSignal[];
}

// ─── Constants ────────────────────────────────────────────────────────
const VALID_RANGES = ["24h", "7d", "30d", "all"] as const;
const DEFAULT_RANGE: TimeRange = "30d";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-recommendations";

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
    const cacheKey = getCacheKey("recommendations", range, filters);
    const cachedData = getCachedValue<RecommendationsResponse>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }

    // 6. Fetch events & build analytics domain data
    const rawEvents = await fetchOnboardingEvents(range);
    const filteredEvents = applyAnalyticsFilters(rawEvents, filters);

    const journeys = buildFounderJourneys(filteredEvents);
    const diagnostics = buildDiagnosticsReport(journeys);
    const recoveries = buildFounderRecoveries(journeys);
    const recoveryReport = buildRecoveryReport(recoveries);

    const providerMetrics = buildProviderMetricsFromEvents(filteredEvents);
    const riskSignals = buildRiskSignalsFromJourneys(journeys);

    // 7. Run recommendation engine
    const { warnings, insights } = buildRecommendations({
      diagnostics,
      recovery: recoveryReport,
      providerMetrics,
      riskSignals,
    });

    const responsePayload: RecommendationsResponse = {
      summary: {
        generatedAt: new Date().toISOString(),
      },
      warnings,
      insights,
      riskSignals,
    };

    // 8. Store in cache
    setCachedValue(cacheKey, responsePayload, RECOMMENDATION_TTL_MS);

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding/recommendations] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
