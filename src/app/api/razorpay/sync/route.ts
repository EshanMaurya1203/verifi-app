import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import Razorpay from "razorpay";
import { computeTrustScore } from "@/lib/scoring";
import { calculateConsistency } from "@/lib/revenue-consistency";


export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { startup_id } = await req.json();

    if (!startup_id) {
      return NextResponse.json({ success: false, error: "Missing startup_id" }, { status: 400 });
    }

    // 1. Fetch connection details (Service Role only)
    const { data: connection, error: connError } = await supabaseServer
      .from("provider_connections")
      .select("*")
      .eq("startup_id", startup_id)
      .eq("provider", "razorpay")
      .eq("status", "connected")
      .single();

    if (connError || !connection) {
      return NextResponse.json({ success: false, error: "No active Razorpay connection found" }, { status: 404 });
    }

    // 2. Initialize Razorpay Client with Decrypted Keys
    const key_secret = decrypt(connection.api_key_encrypted);
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

    interface SyncPayment {
      status: string;
      amount: string | number;
    }

    const totalPaise = (payments.items as SyncPayment[])
      .filter((p: SyncPayment) => p.status === "captured")
      .reduce((sum: number, p: SyncPayment) => sum + Number(p.amount), 0);

    const mrrAmount = totalPaise / 100;

    // 4. Store Snapshots (Aggregate for the period)
    const { error: snapshotError } = await supabaseServer.from("revenue_transactions").insert({
      startup_id,
      provider: "razorpay",
      amount: mrrAmount,
      source: "api",
      period_start: new Date(fromDate * 1000).toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
    });

    if (snapshotError) throw snapshotError;
    
    const { getAggregatedRevenue } = await import("@/lib/revenue-aggregation");
    const aggregated = await getAggregatedRevenue(startup_id);

    // 5. Log Success
    await supabaseServer.from("verification_logs").insert({
      startup_id,
      event: "razorpay_sync_success",
      metadata: { mrr: mrrAmount, count: payments.items.length }
    });

    // 7. Calculate Advanced Metrics
    const consistency = calculateConsistency(payments.items);
    
    // Fetch startup meta for scoring
    const { data: startup } = await supabaseServer
      .from("startup_submissions")
      .select("website, founder_name, founder_twitter, founder_linkedin")
      .eq("id", startup_id)
      .single();

    // 9. Update Startup Profile with New Scores (handled by engine)
    await computeTrustScore(startup_id);

    return NextResponse.json({ 
      success: true, 
      mrr: aggregated.totalRevenue,
      breakdown: aggregated.breakdown
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to sync revenue";
    console.error("Razorpay Sync Error:", err);
    
    // Log Failure
    const body = await req.clone().json();
    if (body.startup_id) {
      await supabaseServer.from("verification_logs").insert({
        startup_id: body.startup_id,
        event: "razorpay_sync_failure",
        metadata: { error: errorMsg }
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: errorMsg 
    }, { status: 500 });
  }
}
