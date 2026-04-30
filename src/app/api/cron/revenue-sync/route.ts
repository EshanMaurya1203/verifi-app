import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";

/**
 * Legacy cron endpoint — delegates to the unified revenue engine.
 * Prefer /api/cron/sync-revenue for the full two-phase approach.
 */
export async function GET(req: Request) {
  // Security Check (e.g. Vercel Cron Secret)
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Fetch all unique startup IDs with active connections
    const { data: connections, error } = await supabaseServer
      .from("provider_connections")
      .select("startup_id")
      .eq("status", "connected");

    if (error) throw error;

    const startupIds = [
      ...new Set((connections || []).map((c) => c.startup_id)),
    ];

    const results = {
      total: startupIds.length,
      successCount: 0,
      failureCount: 0,
      details: [] as any[],
    };

    for (const startupId of startupIds) {
      try {
        await getAggregatedRevenue(startupId);



        results.successCount++;
      } catch (connErr: any) {
        results.failureCount++;
        results.details.push({ id: startupId, error: connErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
    });
  } catch (err: any) {
    console.error("Cron Revenue Sync Failure:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
