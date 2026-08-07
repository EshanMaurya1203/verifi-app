import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOnboardingEvents } from "@/lib/analytics/events";
import { applyAnalyticsFilters } from "@/lib/analytics/filter-engine";
import { normalizeFilters } from "@/lib/analytics/filters";
import { buildFounderJourneys } from "@/lib/analytics/journey-builder";
import { buildFounderRecoveries } from "@/lib/analytics/recovery-engine";
import {
  buildRecoveryReport,
  findRecoveredJourneys,
  findUnrecoveredJourneys,
  type RecoveryReport,
} from "@/lib/analytics/recovery-metrics";
import type { FounderRecovery } from "@/lib/analytics/recovery";
import {
  getCacheKey,
  getCachedValue,
  setCachedValue,
  RECOVERY_TTL_MS,
} from "@/lib/analytics/cache";
import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Response Payload Interface ───────────────────────────────────────
export interface RecoveryResponse {
  readonly summary: {
    readonly generatedAt: string;
    readonly range: TimeRange;
    readonly filters: AnalyticsFilters;
  };
  readonly recovery: RecoveryReport;
  readonly recovered: readonly FounderRecovery[];
  readonly unrecovered: readonly FounderRecovery[];
}

// ─── Constants ────────────────────────────────────────────────────────
const VALID_RANGES = ["24h", "7d", "30d", "all"] as const;
const DEFAULT_RANGE: TimeRange = "7d";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-recovery";

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
    const cacheKey = getCacheKey("recovery", range, filters);
    const cachedResponse = getCachedValue<RecoveryResponse>(cacheKey);

    if (cachedResponse) {
      return NextResponse.json(cachedResponse, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cache": "HIT",
          "X-Cache-TTL": String(RECOVERY_TTL_MS / 1000),
        },
      });
    }

    // 6. Execute pipeline: Fetch → Filter → Build Journeys → Recoveries → Metrics
    const rawEvents = await fetchOnboardingEvents(range);
    const filteredEvents = applyAnalyticsFilters(rawEvents, filters);
    const journeys = buildFounderJourneys(filteredEvents);
    const recoveries = buildFounderRecoveries(journeys);

    const report = buildRecoveryReport(recoveries);
    const recoveredList = findRecoveredJourneys(recoveries);
    const unrecoveredList = findUnrecoveredJourneys(recoveries);

    const response: RecoveryResponse = {
      summary: {
        generatedAt: new Date().toISOString(),
        range,
        filters,
      },
      recovery: report,
      recovered: recoveredList,
      unrecovered: unrecoveredList,
    };

    // 7. Store in cache
    setCachedValue(cacheKey, response, RECOVERY_TTL_MS);

    // 8. Return response
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Cache": "MISS",
        "X-Cache-TTL": String(RECOVERY_TTL_MS / 1000),
      },
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding/recovery] Internal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
