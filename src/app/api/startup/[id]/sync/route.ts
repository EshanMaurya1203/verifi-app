import { getSupabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { computeTrustScore } from "@/lib/scoring";
import { decrypt } from "@/lib/encryption";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  // 1. Fetch provider connections for this startup
  const { data: connections, error: connError } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("startup_id", id)
    .eq("status", "connected");

  if (connError) {
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }

  let snapshotsSynced = 0;

  // 2. Sync transactions from providers
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
                startup_id: id,
                provider: "razorpay",
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                external_id: p.id,
                created_at: new Date(p.created_at * 1000).toISOString(),
              },
              { onConflict: "external_id" }
            );
          if (!upsertError) snapshotsSynced++;
        }
      } else if (conn.provider === "stripe") {
        const stripe = new Stripe(decryptedKey, {
          apiVersion: "2024-04-10" as any,
        });
        const from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
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
                  startup_id: id,
                  provider: "stripe",
                  amount: tx.amount,
                  currency: tx.currency?.toUpperCase() || "USD",
                  status: "captured",
                  external_id: tx.id,
                  created_at: new Date(tx.created * 1000).toISOString(),
                },
                { onConflict: "external_id" }
              );
            if (!upsertError) snapshotsSynced++;
          }
        }
      }
    } catch (err) {
      console.error(`[Manual Sync] Error for connection ${conn.id}:`, err);
    }
  }

  // 3. Recompute aggregated stats
  try {
    await getAggregatedRevenue(Number(id));
    await computeTrustScore(Number(id));
    
    // Update overview timestamp or status if needed
    await supabase
      .from("startup_submissions")
      .update({ payment_connected: true })
      .eq("id", id);

  } catch (err) {
    console.error(`[Manual Sync] Aggregation error:`, err);
    return NextResponse.json({ error: "Failed to aggregate revenue" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    snapshots_synced: snapshotsSynced
  });
}
