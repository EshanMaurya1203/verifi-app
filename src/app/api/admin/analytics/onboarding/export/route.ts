import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildExportPayload,
  buildExportResponse,
  ExportFormat,
  ExportType,
} from "@/lib/analytics/export";
import { normalizeFilters } from "@/lib/analytics/filters";
import type { TimeRange } from "@/lib/analytics/types";

// ─── Route Configuration ──────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────

const VALID_FORMATS = ["csv", "json"] as const;
const VALID_TYPES = [
  "full",
  "funnel",
  "trends",
  "comparison",
  "failures",
  "drafts",
  "diagnostics",
  "recovery",
  "recommendations",
] as const;
const VALID_RANGES = ["24h", "7d", "30d", "all"] as const;

const DEFAULT_FORMAT: ExportFormat = "json";
const DEFAULT_TYPE: ExportType = "full";
const DEFAULT_RANGE: TimeRange = "7d";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_KEY_PREFIX = "admin-analytics-export";

// ─── Validation ───────────────────────────────────────────────────────

function validateFormat(value: string | null): ExportFormat | null {
  if (!value) return DEFAULT_FORMAT;
  if ((VALID_FORMATS as readonly string[]).includes(value)) {
    return value as ExportFormat;
  }
  return null;
}

function validateType(value: string | null): ExportType | null {
  if (!value) return DEFAULT_TYPE;
  if ((VALID_TYPES as readonly string[]).includes(value)) {
    return value as ExportType;
  }
  return null;
}

function validateRange(value: string | null): TimeRange | null {
  if (!value) return DEFAULT_RANGE;
  if ((VALID_RANGES as readonly string[]).includes(value)) {
    return value as TimeRange;
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

    // 3. Validate query parameters
    const { searchParams } = new URL(request.url);

    const format = validateFormat(searchParams.get("format"));
    const type = validateType(searchParams.get("type"));
    const range = validateRange(searchParams.get("range"));

    if (!format || !type || !range) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const providerParam = searchParams.get("provider");
    const outcomeParam = searchParams.get("outcome");
    const filters = normalizeFilters(providerParam, outcomeParam);

    // FIX 1: Reject multi-section full CSV exports
    if (type === "full" && format === "csv") {
      return NextResponse.json(
        { error: "Full exports are available only in JSON format." },
        { status: 400 }
      );
    }

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

    // 5. Build export payload & response
    const payload = await buildExportPayload(type, range, filters);
    const { body, headers } = buildExportResponse(payload, type, range, format, filters);

    // Export Audit Logging
    console.log(
      "[ADMIN_EXPORT_AUDIT]",
      JSON.stringify({
        adminId: user.id,
        type,
        format,
        range,
        filters,
        timestamp: new Date().toISOString(),
      })
    );

    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[admin/analytics/onboarding/export] Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
