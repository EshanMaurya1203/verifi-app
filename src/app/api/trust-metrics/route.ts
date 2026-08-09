import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { canStartupBePublic } from "@/lib/visibility";
import { isDemoStartupUserId } from "@/lib/verification-data";

// Public read-only aggregate trust metrics endpoint.
// Policy: 15 requests per 60 seconds window. Fail-open enabled for Redis resilience.
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 15;

export async function GET(request: Request) {
  const identifier = getClientIdentifier(request);
  const { allowed } = await checkRateLimit(
    identifier,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    { failOpen: true }
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
        },
      }
    );
  }

  try {
    // 1. Fetch startup submissions requiring both public status and connected payment
    const { data: startups, error: errSub } = await supabaseServer
      .from("startup_submissions")
      .select("id, user_id, is_public, payment_connected, verification_status")
      .eq("is_public", true)
      .eq("payment_connected", true);

    if (errSub) {
      console.error("[TrustMetrics API] Database error fetching submissions:", errSub);
      return NextResponse.json(
        { success: false, error: "Failed to fetch trust metrics" },
        { status: 500 }
      );
    }

    // 2. Filter using canonical eligibility helpers (visibility, demo exclusion, non-flagged)
    const eligibleStartups = (startups || []).filter((sub) => {
      if (sub.is_public !== true) return false;
      if (sub.payment_connected !== true) return false;
      if (!canStartupBePublic(sub).eligible) return false;
      if (isDemoStartupUserId(sub.user_id)) return false;
      if (sub.verification_status === "flagged") return false;
      return true;
    });

    const verifiedStartupCount = eligibleStartups.length;
    let verifiedRevenueTotal = 0;

    // 3. For eligible startups, query canonical combined revenue_snapshots (prevents multi-provider double-counting)
    if (eligibleStartups.length > 0) {
      const eligibleIds = eligibleStartups.map((s) => s.id);

      const { data: snapshots, error: errSnap } = await supabaseServer
        .from("revenue_snapshots")
        .select("startup_id, total_revenue, created_at")
        .in("startup_id", eligibleIds)
        .eq("provider", "combined")
        .order("created_at", { ascending: false });

      if (!errSnap && snapshots) {
        // Retain only the latest combined snapshot per startup to avoid history duplication
        const latestSnapshotPerStartup = new Map<string | number, number>();
        for (const snap of snapshots) {
          if (!latestSnapshotPerStartup.has(snap.startup_id)) {
            latestSnapshotPerStartup.set(snap.startup_id, Number(snap.total_revenue) || 0);
          }
        }

        for (const revenue of latestSnapshotPerStartup.values()) {
          verifiedRevenueTotal += revenue;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        verifiedStartupCount,
        verifiedRevenueTotal,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
        },
      }
    );
  } catch (error) {
    console.error("[TrustMetrics API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
