import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encrypt } from "@/lib/encryption";
import { computeTrustScore } from "@/lib/scoring";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import Stripe from "stripe";

/**
 * Stripe Verification API (/api/stripe/verify)
 */
export async function POST(req: Request) {
  try {
    const { apiKey, startupId, debug } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    console.log("Stripe verify started");
    console.log("Using API key prefix:", apiKey.slice(0, 10));

    // 1. Initialize Stripe
    const stripe = new Stripe(apiKey, { 
      apiVersion: "2024-04-10" as any,
    });

    let allPayments: Stripe.PaymentIntent[] = [];
    try {
      // 2. Fetch all payments via pagination
      let hasMore = true;
      let startingAfter: string | undefined = undefined;

      while (hasMore) {
        const res = await stripe.paymentIntents.list({
          limit: 100,
          starting_after: startingAfter,
        });

        allPayments = [...allPayments, ...res.data];

        hasMore = res.has_more;

        if (res.data.length > 0) {
          startingAfter = res.data[res.data.length - 1].id;
        } else {
          break;
        }
      }
    } catch (err: any) {
      console.error("Stripe error:", err.message);
      return NextResponse.json({ error: "Stripe failed" }, { status: 500 });
    }

    console.log("Total payments fetched:", allPayments.length);

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 3. Filter successful payments within last 30 days
    const recentPayments = allPayments.filter(p => {
      return (
        p.status === "succeeded" &&
        (now - p.created * 1000) <= THIRTY_DAYS
      );
    });

    console.log("Recent payments:", recentPayments.length);
    console.log("Raw amounts:", recentPayments.map(p => p.amount));

    // 4. Calculate REAL MRR based on sum of the last 30 days
    const mrr = recentPayments.reduce((sum, p) => {
      return sum + (p.amount || 0);
    }, 0) / 100;
    
    console.log("MRR (last 30 days):", mrr);

    const amounts = recentPayments.map(p => p.amount / 100);
    const max = amounts.length > 0 ? Math.max(...amounts) : 0;
    const avg = amounts.length > 0 ? (amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;

    let spikeDetected = false;
    if (amounts.length > 0 && max > avg * 5) {
      console.warn("⚠️ Revenue spike detected — possible manipulation");
      spikeDetected = true;
      if (startupId) {
        await supabaseAdmin.from("fraud_signals").insert({
          startup_id: startupId,
          signal_type: "REVENUE_SPIKE",
          severity: 3, 
          description: "Revenue spike detected (max > 5x avg)"
        });
      }
    }

    const currency = recentPayments[0]?.currency.toUpperCase() || "USD";
    const total_transactions = recentPayments.length;

    // DO NOT mark as verified if revenue fetch fails or is zero
    if (total_transactions === 0 || mrr === 0) {
      return NextResponse.json({ error: "No revenue detected" }, { status: 400 });
    }

    // 5. Persistence
    let aggregatedResult: any = null;
    if (startupId) {
      const account = await (stripe.accounts as any).retrieve().catch(() => ({ id: "sk_manual" }));
      const stripeAccountId = account.id;
      const encryptedKey = encrypt(apiKey);
      
      // Use explicit select then insert/update to avoid common onConflict constraint mismatches
      const { data: existingConn } = await supabaseAdmin
        .from("provider_connections")
        .select("id")
        .eq("startup_id", startupId)
        .eq("provider", "stripe")
        .single();

      let connError;
      if (existingConn) {
        const { error } = await supabaseAdmin
          .from("provider_connections")
          .update({
            account_id: stripeAccountId,
            api_key_encrypted: encryptedKey,
            status: "connected",
            latest_revenue: mrr,
            last_synced_at: new Date().toISOString()
          })
          .eq("id", existingConn.id);
        connError = error;
      } else {
        const { error } = await supabaseAdmin
          .from("provider_connections")
          .insert({
            startup_id: startupId,
            provider: "stripe",
            account_id: stripeAccountId,
            api_key_encrypted: encryptedKey,
            status: "connected",
            latest_revenue: mrr,
            last_synced_at: new Date().toISOString()
          });
        connError = error;
      }

      if (connError) throw connError;

      const { data: last } = await supabaseAdmin
        .from("revenue_transactions")
        .select("*")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (last && last.length > 0 && last[0].amount === mrr) {
        console.log("No change in revenue — skipping duplicate insert");
      } else {
        await supabaseAdmin.from("revenue_transactions").insert({
          startup_id: startupId,
          amount: mrr,
          provider: "stripe",
          source: "stripe",
          currency: currency
        });
      }

      aggregatedResult = await getAggregatedRevenue(startupId);

      const { error: updError } = await supabaseAdmin
        .from("startup_submissions")
        .update({ 
          payment_connected: true,
          verification_status: "api_verified",
          last_verified_at: new Date().toISOString(),
          raw_metrics: { 
            payment_count: total_transactions,
            spike_detected: spikeDetected
          }
        })
        .eq("id", startupId);

      if (updError) throw updError;

      const { data: startupBefore } = await supabaseAdmin
        .from("startup_submissions")
        .select("trust_score")
        .eq("id", startupId)
        .single();
        
      console.log("Trust score BEFORE:", startupBefore?.trust_score || 0);

      const scoreResult = await computeTrustScore(startupId);

      console.log("Trust score AFTER:", scoreResult.score);

      console.log("DB updated:", {
        startup_id: startupId,
        revenue: mrr,
        trust_score: scoreResult.score
      });
    }

    if (debug) {
      return NextResponse.json({
        revenue: mrr,
        payments_count: allPayments.length,
        successful_count: recentPayments.length,
        raw_amounts: recentPayments.map(p => p.amount)
      });
    }

    return NextResponse.json({ revenue: aggregatedResult?.totalRevenue ?? mrr, breakdown: aggregatedResult?.breakdown, currency, total_transactions });

  } catch (err: any) {
    console.error("CRITICAL VERIFICATION ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
