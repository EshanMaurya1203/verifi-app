import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Revenue Sync API (/api/sync/stripe)
 * 
 * Simulates fetching live transaction data from Stripe and
 * persisting it to the revenue_snapshots table.
 */
export async function POST() {
  try {
    // 1. Fetch active Stripe connections (simulating looking up API keys)
    const { data: connections, error: connError } = await supabaseServer
      .from("payment_connections")
      .select("startup_id")
      .eq("provider", "stripe")
      .eq("is_active", true);

    if (connError) {
      console.error("[SyncStripe] Connection fetch error:", connError);
      return NextResponse.json({ error: connError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: "No active Stripe connection found for sync" }, { status: 404 });
    }

    // For this simulation, we sync for the first found connection
    const startupId = connections[0].startup_id;

    // 2. Simulate data ingestion (Mock transactions with staggered timestamps)
    const now = Date.now();
    const events = [
      { 
        startup_id: startupId, 
        amount: 1000, 
        provider: "stripe", 
        timestamp: now - 60000 
      },
      { 
        startup_id: startupId, 
        amount: 1200, 
        provider: "stripe", 
        timestamp: now - 30000 
      },
      { 
        startup_id: startupId, 
        amount: 1500, 
        provider: "stripe", 
        timestamp: now 
      }
    ];

    const { error: insertError } = await supabaseServer
      .from("revenue_events")
      .insert(events);

    if (insertError) {
      console.error("[SyncStripe] Event insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Revenue events synced from Stripe",
      syncedEvents: events.length,
      startupId
    });

  } catch (error) {
    console.error("[SyncStripe] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
