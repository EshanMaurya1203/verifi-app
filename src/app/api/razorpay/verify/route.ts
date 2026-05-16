import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase-server";
import { encrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { key_id, key_secret, startup_id } = await req.json();

    if (!key_id || !key_secret || !startup_id) {
      return NextResponse.json({ success: false, error: "Missing keys or startup ID" }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    // Test API call to verify keys
    try {
      await razorpay.payments.all({ count: 1 });
    } catch (apiErr: unknown) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid Razorpay API keys. Please check your Key ID and Secret." 
      }, { status: 400 });
    }

    // Store connection in Database
    const { error: dbError } = await supabaseServer.from("provider_connections").upsert({
      startup_id,
      provider: "razorpay",
      account_id: key_id,
      api_key_encrypted: encrypt(key_secret),
      status: "connected"
    }, { onConflict: "startup_id,provider" });

    if (dbError) {
      console.error("Database connection storage error:", dbError);
      return NextResponse.json({ success: false, error: "Connection verified but failed to save to database" }, { status: 500 });
    }

    // --- TRIGGER IMMEDIATE SYNC FLOW ---
    try {
      // 1. Fetch initial snapshots
      const payments = await razorpay.payments.all({ count: 20 });
      for (const p of payments.items) {
        if (p.status !== "captured") continue;
        await supabaseServer.from("revenue_transactions").upsert({
          startup_id,
          provider: "razorpay",
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          external_id: p.id,
          created_at: new Date(p.created_at * 1000).toISOString(),
        }, { onConflict: "external_id" });
      }

      // 2. Trigger unified revenue aggregation engine
      const { getAggregatedRevenue } = await import("@/lib/revenue-aggregation");
      const { computeTrustScore } = await import("@/lib/scoring");

      const aggregatedResult = await getAggregatedRevenue(startup_id);

      // Persist snapshot for metrics engine (MRR history / growth tracking)
      const snapshotRevenue = aggregatedResult?.totalRevenue ?? 0;

      const { data: lastSnap } = await supabaseServer
        .from("revenue_snapshots")
        .select("*")
        .eq("startup_id", startup_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastSnap && lastSnap[0]?.total_revenue === snapshotRevenue) {
        console.log("[Razorpay] Skipping duplicate snapshot — revenue unchanged");
      } else {
        await supabaseServer.from("revenue_snapshots").insert({
          startup_id: startup_id,
          total_revenue: snapshotRevenue,
          provider_breakdown: aggregatedResult?.breakdown || { razorpay: snapshotRevenue },
          provider: "razorpay",
          created_at: new Date().toISOString(),
        });
        console.log("[Razorpay] Snapshot persisted:", { startup_id, total_revenue: snapshotRevenue });
      }

      await computeTrustScore(startup_id);

      // 3. Mark connected
      await supabaseServer.from("startup_submissions").update({ 
        payment_connected: true
      }).eq("id", startup_id);

    } catch (syncErr) {
      console.error("Initial sync failure:", syncErr);
      // We don't return error here because the connection is already saved.
    }

    return NextResponse.json({
      success: true,
      message: "Razorpay connected and initial sync complete"
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Connection failed";
    console.error("Razorpay verification error:", err);
    return NextResponse.json({
      success: false,
      error: errorMsg
    }, { status: 400 });
  }
}
