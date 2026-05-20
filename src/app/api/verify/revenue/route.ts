import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";

/**
 * Unified Revenue Verification API
 *
 * Fetches live revenue from ALL connected providers for a startup,
 * aggregates the total, persists the result, and returns it.
 *
 * POST /api/verify/revenue
 * Body: { startup_id: number }
 */
import { verifyStartupOwnership } from "@/lib/auth-server";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { startup_id } = await req.json();

    if (!startup_id) {
      return NextResponse.json(
        { success: false, error: "Missing startup_id" },
        { status: 400 }
      );
    }

    // Enforce authentication and strict startup ownership validation
    const { authenticated, owned } = await verifyStartupOwnership(startup_id);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    const result = await getAggregatedRevenue(startup_id);

    if (result.providers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No connected revenue sources found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      revenue: result.totalRevenue,
      breakdown: result.breakdown,
      providers: result.providers.map((p) => ({
        provider: p.provider,
        revenue: p.revenue,
        currency: p.currency,
        status: p.success ? "synced" : "error",
        error: p.error,
      })),
    });
  } catch (error: any) {
    console.error("Revenue aggregation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
