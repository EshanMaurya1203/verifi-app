import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { computeTrustScore } from "@/lib/scoring";
import { decrypt } from "@/lib/encryption";
import { getPlatformStripe, getStripeForSecretKey, isStripeConnectAccountId } from "@/lib/stripe";
import { resyncExistingRazorpayConnection } from "@/lib/razorpay-sync";

import { verifyStartupOwnership } from "@/lib/auth-server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Enforce authentication and strict startup ownership validation
  const { authenticated, owned, startup: _startup, user } = await verifyStartupOwnership(id);
  if (!authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!owned) {
    return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
  }

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
        const result = await resyncExistingRazorpayConnection(Number(id));
        if (result) snapshotsSynced += (result.total_transactions || 0);
      } else if (conn.provider === "stripe") {
        const stripe = isStripeConnectAccountId(conn.account_id)
          ? getPlatformStripe()
          : getStripeForSecretKey(decryptedKey);
          
        const { data: latestTx } = await supabase
          .from("revenue_transactions")
          .select("created_at")
          .eq("startup_id", id)
          .eq("provider", "stripe")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let from: number;
        if (latestTx && latestTx.created_at) {
          from = Math.floor(new Date(latestTx.created_at).getTime() / 1000);
        } else {
          from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        }

        const requestOptions = isStripeConnectAccountId(conn.account_id)
          ? { stripeAccount: conn.account_id }
          : undefined;

        let batch: Record<string, unknown>[] = [];
        const BATCH_SIZE = 500;

        for await (const tx of stripe.balanceTransactions.list(
          { created: { gt: from }, limit: 100 },
          requestOptions
        )) {
          if (tx.type === "charge" || tx.type === "payment") {
            batch.push({
              startup_id: id,
              provider: "stripe",
              amount: tx.amount / 100,
              currency: tx.currency?.toUpperCase() || "USD",
              status: "captured",
              external_id: tx.id,
              payment_id: tx.id,
              created_at: new Date(tx.created * 1000).toISOString(),
            });
            
            if (batch.length >= BATCH_SIZE) {
              const { error: upsertError } = await supabase
                .from("revenue_transactions")
                .upsert(batch, { onConflict: "external_id" });
              if (!upsertError) snapshotsSynced += batch.length;
              batch = [];
            }
          }
        }
        
        if (batch.length > 0) {
          const { error: upsertError } = await supabase
            .from("revenue_transactions")
            .upsert(batch, { onConflict: "external_id" });
          if (!upsertError) snapshotsSynced += batch.length;
        }
      }
    } catch (err: unknown) {
      const isProviderError = err instanceof Error && err.name === "ProviderError";
      const logPayload = isProviderError ? ((err as unknown as Record<string, unknown>).originalError ?? err) : err;
      console.error(`[Manual Sync] Error for connection ${conn.id}:`, logPayload);
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
