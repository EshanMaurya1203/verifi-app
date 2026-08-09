import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

// Rate limit policy for public read-only live-feed endpoint: 15 requests per 60 seconds window.
// Fail-open is enabled so Redis outages do not block public read access to the live feed.
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
    const { data, error } = await supabaseServer
      .from("verification_logs")
      .select(`
        id,
        event,
        created_at,
        startup_submissions!inner (
          startup_name,
          is_public,
          payment_connected,
          user_id,
          verification_status
        )
      `)
      .eq("startup_submissions.is_public", true)
      .eq("startup_submissions.payment_connected", true)
      .or("user_id.is.null,user_id.not.like.00000000-0000-0000-0000-%", { foreignTable: "startup_submissions" })
      .or("verification_status.is.null,verification_status.neq.flagged", { foreignTable: "startup_submissions" })
      .in("event", ["stripe_sync_success", "razorpay_sync_success", "listing_created"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[LiveFeed API] Database error:", error);
      return NextResponse.json({ error: "Failed to fetch live feed" }, { status: 500 });
    }

    const events = (data || []).map((log: any) => ({
      id: log.id,
      event: log.event,
      startupName: log.startup_submissions.startup_name,
      timestamp: log.created_at,
    }));

    return NextResponse.json(events);
  } catch (error) {
    console.error("[LiveFeed API] Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
