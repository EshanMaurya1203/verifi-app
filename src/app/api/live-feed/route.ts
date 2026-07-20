import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("verification_logs")
      .select(`
        id,
        event,
        created_at,
        startup_submissions!inner (
          startup_name,
          is_public
        )
      `)
      .eq("startup_submissions.is_public", true)
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
