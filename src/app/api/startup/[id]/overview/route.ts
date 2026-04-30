import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { calculateTrustScore } from "@/lib/scoring";

/**
 * Startup Overview API (/api/startup/[id]/overview)
 * 
 * Aggregates core startup metadata, provider connection health, 
 * and historical revenue snapshots for the dashboard.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const startupId = Number(rawId);

  // 1. Validate Startup ID
  if (isNaN(startupId)) {
    return NextResponse.json({ error: "Invalid startup ID" }, { status: 400 });
  }

  // 2. Rate Limiting
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }


  try {
    // 3. Parallel Data Fetching (Using Number ID and payment_connections table)
    const [startupRes, connectionsRes, revenueRes, fraudRes] = await Promise.all([
      supabaseServer
        .from("startup_submissions")
        .select("id, startup_name, trust_score, penalty_count")
        .eq("id", startupId)
        .single(),
      supabaseServer
        .from("payment_connections")
        .select("provider, is_active")
        .eq("startup_id", startupId),
      supabaseServer
        .from("revenue_events")
        .select("amount, timestamp")
        .eq("startup_id", startupId)
        .order("timestamp", { ascending: true })
        .limit(100),
      supabaseServer
        .from("fraud_signals")
        .select("signal_type")
        .eq("startup_id", startupId)
    ]);

    // Handle missing startup
    if (startupRes.error || !startupRes.data) {
      console.warn(`[StartupOverview] Startup not found: ${startupId}`);
      return NextResponse.json({ error: "Startup not found" }, { status: 404 });
    }

    // 4. Transformation to requested JSON structure
    const overview: any = {
      startup: {
        id: startupRes.data.id,
        name: startupRes.data.startup_name,
        trust_score: startupRes.data.trust_score
      },
      // Using row.is_active as requested
      connections: (connectionsRes.data || []).map(row => ({
        provider: row.provider,
        connected: row.is_active,
        last_sync: null, // As requested
        mrr: 0 // As requested
      })),
      revenue: (revenueRes.data || []).map(event => ({
        timestamp: Number(event.timestamp),
        amount: Number(event.amount) || 0
      }))
    };

    // 5. Compute dynamic trust score from revenue events and fraud signals
    const fraudSignals = {
      rate_limit_violations: (fraudRes.data || []).filter(f => f.signal_type === 'rate_limit').length,
      spike_events: (fraudRes.data || []).filter(f => f.signal_type === 'revenue_spike').length,
      penalty_count: Number(startupRes.data?.penalty_count) || 0
    };

    overview.startup.trust_score = calculateTrustScore(overview.revenue, fraudSignals);

    return NextResponse.json(overview);

  } catch (error) {
    console.error("[StartupOverview] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
