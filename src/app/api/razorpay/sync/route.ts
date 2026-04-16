import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt } from "@/lib/encryption";
import { computeTrustScore } from "@/lib/scoring";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    const { startup_id } = await req.json();

    if (!startup_id) {
      return NextResponse.json({ success: false, error: "Missing startup_id" }, { status: 400 });
    }

    // 1. Fetch connection details (Service Role only)
    const { data: connection, error: connError } = await supabaseAdmin
      .from("payment_connections")
      .select("*")
      .eq("startup_id", startup_id)
      .eq("provider", "razorpay")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return NextResponse.json({ success: false, error: "No active Razorpay connection found" }, { status: 404 });
    }

    // 2. Initialize Razorpay Client with Decrypted Keys
    const key_secret = decrypt(connection.access_token);
    const razorpay = new Razorpay({
      key_id: connection.account_id,
      key_secret: key_secret,
    });

    // 3. Sync Payments (Last 30 Days)
    const fromDate = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const payments = await razorpay.payments.all({ 
      from: fromDate,
      count: 100 
    });

    const totalPaise = payments.items
      .filter((p: any) => p.status === "captured")
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const mrrAmount = totalPaise / 100;

    // 4. Store Snapshots (Aggregate for the period)
    const { error: snapshotError } = await supabaseAdmin.from("revenue_snapshots").insert({
      startup_id,
      provider: "razorpay",
      amount: mrrAmount,
      source: "api",
      period_start: new Date(fromDate * 1000).toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
    });

    if (snapshotError) throw snapshotError;

    // 5. Log Success
    await supabaseAdmin.from("verification_logs").insert({
      startup_id,
      event: "razorpay_sync_success",
      metadata: { mrr: mrrAmount, count: payments.items.length }
    });

    // 6. Update Startup Profile
    await supabaseAdmin.from("startup_submissions").update({
      mrr: mrrAmount,
      last_verified_at: new Date().toISOString()
    }).eq("id", startup_id);

    // 7. Recalculate Trust Score
    await computeTrustScore(startup_id);

    return NextResponse.json({ 
      success: true, 
      mrr: mrrAmount 
    });

  } catch (err: any) {
    console.error("Razorpay Sync Error:", err);
    
    // Log Failure
    const body = await req.clone().json();
    if (body.startup_id) {
      await supabaseAdmin.from("verification_logs").insert({
        startup_id: body.startup_id,
        event: "razorpay_sync_failure",
        metadata: { error: err.message }
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: err.message || "Failed to sync revenue" 
    }, { status: 500 });
  }
}
