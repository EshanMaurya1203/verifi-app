import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { canStartupBePublic } from "@/lib/visibility";
import { isDemoStartupUserId } from "@/lib/verification-data";

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
      .in("event", ["stripe_sync_success", "razorpay_sync_success", "listing_created"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[LiveFeed API] Database error:", error);
      return NextResponse.json({ error: "Failed to fetch live feed" }, { status: 500 });
    }

    type LiveFeedLog = {
      id: number | string;
      event: string;
      created_at: string;
      startup_submissions: {
        startup_name: string;
        is_public?: boolean | null;
        payment_connected?: boolean | null;
        user_id?: string | null;
        verification_status?: string | null;
      };
    };

    const events = ((data as unknown as LiveFeedLog[]) || [])
      .filter((log) => {
        const sub = log.startup_submissions;
        if (!sub) return false;
        if (sub.is_public !== true) return false;
        if (!canStartupBePublic(sub).eligible) return false;
        if (isDemoStartupUserId(sub.user_id)) return false;
        if (sub.verification_status === "flagged") return false;
        return true;
      })
      .slice(0, 20)
      .map((log) => ({
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
