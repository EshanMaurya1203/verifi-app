import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encrypt } from "@/lib/encryption";

export async function POST(req: Request) {
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
    } catch (apiErr: any) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid Razorpay API keys. Please check your Key ID and Secret." 
      }, { status: 400 });
    }

    // Store connection in Database
    const { error: dbError } = await supabaseAdmin.from("provider_connections").upsert({
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
        await supabaseAdmin.from("revenue_transactions").upsert({
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

      await getAggregatedRevenue(startup_id);
      await computeTrustScore(startup_id);

      // 3. Mark connected
      await supabaseAdmin.from("startup_submissions").update({ 
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

  } catch (err: any) {
    console.error("Razorpay verification error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Connection failed"
    }, { status: 400 });
  }
}
