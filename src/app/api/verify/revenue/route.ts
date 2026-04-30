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
