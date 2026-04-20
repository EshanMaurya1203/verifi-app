import { getSupabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { computeTrustScore } from "@/lib/scoring";
import { decrypt } from "@/lib/encryption";

/**
 * Cron Revenue Sync
 *
 * Two-phase approach:
 *   Phase 1 — Store transaction-level snapshots per provider connection
 *   Phase 2 — Aggregate revenue per startup via the unified engine
 */
export async function GET(req: Request) {
  // Security check for Vercel Cron
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = getSupabaseServer();

  // Fetch all active provider connections
  const { data: connections, error: connError } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("status", "connected");

  if (connError) {
    console.error("Failed to fetch connections:", connError);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }

  const results = {
    processed_startups: 0,
    new_snapshots: 0,
    errors: [] as string[],
  };

  const processedStartups = new Set<number>();

  // ─── Phase 1: Store transaction-level snapshots per connection ────
  for (const conn of connections || []) {
    try {
      const decryptedKey = decrypt(conn.api_key_encrypted);

      if (conn.provider === "razorpay") {
        const razorpay = new Razorpay({
          key_id: conn.account_id,
          key_secret: decryptedKey,
        });

        const payments = await razorpay.payments.all({ count: 50 });
        for (const p of payments.items) {
          if (p.status !== "captured") continue;
          const { error: upsertError } = await supabase
            .from("revenue_transactions")
            .upsert(
              {
                startup_id: conn.startup_id,
                provider: "razorpay",
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                external_id: p.id,
                created_at: new Date(p.created_at * 1000).toISOString(),
              },
              { onConflict: "external_id" }
            );
          if (!upsertError) results.new_snapshots++;
        }
      } else if (conn.provider === "stripe") {
        const stripe = new Stripe(decryptedKey, {
          apiVersion: "2024-04-10" as any,
        });
        const from = Math.floor(
          (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
        );
        const bTxns = await stripe.balanceTransactions.list({
          created: { gte: from },
          limit: 100,
        });

        for (const tx of bTxns.data) {
          if (tx.type === "charge" || tx.type === "payment") {
            const { error: upsertError } = await supabase
              .from("revenue_transactions")
              .upsert(
                {
                  startup_id: conn.startup_id,
                  provider: "stripe",
                  amount: tx.amount,
                  currency: tx.currency?.toUpperCase() || "USD",
                  status: "captured",
                  external_id: tx.id,
                  created_at: new Date(tx.created * 1000).toISOString(),
                },
                { onConflict: "external_id" }
              );
            if (!upsertError) results.new_snapshots++;
          }
        }
      }

      processedStartups.add(conn.startup_id);
    } catch (err: any) {
      console.error(`Snapshot sync error for connection ${conn.id}:`, err);
      results.errors.push(`Connection ${conn.id}: ${err.message}`);
    }
  }

  // ─── Phase 2: Aggregate revenue per startup via unified engine ────
  for (const startupId of processedStartups) {
    try {
      await getAggregatedRevenue(startupId);
      await computeTrustScore(startupId);

      await supabase
        .from("startup_submissions")
        .update({ payment_connected: true })
        .eq("id", startupId);

      results.processed_startups++;
    } catch (err: any) {
      console.error(`Aggregation error for startup ${startupId}:`, err);
      results.errors.push(`Startup ${startupId}: ${err.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.processed_startups,
    snapshots_synced: results.new_snapshots,
    errors_encountered: results.errors.length,
  });
}
