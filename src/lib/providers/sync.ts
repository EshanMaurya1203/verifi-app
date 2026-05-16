import { supabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { detectFraud } from "@/lib/fraud";
import { RevenueProvider, NormalizedPayment } from "./types";
import { encrypt } from "@/lib/encryption";

export async function runProviderSync(
  startupId: string,
  providerName: string,
  provider: RevenueProvider,
  credentials: {
    stripeApiKey?: string;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
  }
) {
  // 1. Fetch normalized payments
  const allPayments = await provider.fetchPayments();
  
  // Filter successful payments
  const recentPayments = allPayments.filter(p => p.status === "successful");

  // 2. Calculate REAL MRR based on sum of the last 30 days
  const mrr = recentPayments.reduce((sum, p) => sum + p.amount, 0);

  // --- FRAUD DETECTION ---
  let spikeDetected = false;
  let rateLimitTriggered = false;
  let isClean = false;

  const { data: history } = await supabaseServer
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(4);

  const prevTxAmounts = (history ?? []).map(h => Number(h.amount));
  const prevTimestamps = (history ?? []).map(h => new Date(h.created_at).getTime());

  const amounts = recentPayments.map(p => p.amount);
  const currentMaxTx = amounts.length > 0 ? Math.max(...amounts) : 0;

  const fraud = detectFraud({
    amount: currentMaxTx,
    previousTransactions: prevTxAmounts,
    timestamps: prevTimestamps,
    now: Date.now()
  });

  spikeDetected = fraud.reason === "spike";
  rateLimitTriggered = fraud.reason === "rate_limit";
  isClean = !fraud.isFraud && mrr >= 100;

  if (spikeDetected) {
    console.warn(`⚠️ Revenue spike detected — possible manipulation via ${providerName}`);
    await supabaseServer.from("fraud_signals").insert({
      startup_id: startupId,
      signal_type: "REVENUE_SPIKE",
      severity: 3, 
      description: `Revenue spike detected via API verification (${providerName})`
    });
  }

  const currency = recentPayments[0]?.currency.toUpperCase() || "USD";
  const total_transactions = recentPayments.length;

  if (total_transactions === 0 || mrr === 0) {
    throw new Error("No revenue detected");
  }

  // 3. Persistence
  let accountId = "";
  let encryptedKey = "";

  if (providerName === "stripe" && credentials.stripeApiKey) {
    accountId = "sk_manual"; // In a real app we might fetch account details via Stripe API
    encryptedKey = encrypt(credentials.stripeApiKey);
  } else if (providerName === "razorpay" && credentials.razorpayKeyId && credentials.razorpayKeySecret) {
    accountId = credentials.razorpayKeyId;
    encryptedKey = encrypt(credentials.razorpayKeySecret);
  }

  // Save connection
  const { data: existingConn } = await supabaseServer
    .from("provider_connections")
    .select("id")
    .eq("startup_id", startupId)
    .eq("provider", providerName)
    .single();

  if (existingConn) {
    await supabaseServer
      .from("provider_connections")
      .update({
        account_id: accountId,
        api_key_encrypted: encryptedKey,
        status: "connected",
        latest_revenue: mrr,
        last_synced_at: new Date().toISOString()
      })
      .eq("id", existingConn.id);
  } else {
    await supabaseServer
      .from("provider_connections")
      .insert({
        startup_id: startupId,
        provider: providerName,
        account_id: accountId,
        api_key_encrypted: encryptedKey,
        status: "connected",
        latest_revenue: mrr,
        last_synced_at: new Date().toISOString()
      });
  }

  // Insert latest transaction record to trigger webhooks/updates if needed
  const { data: lastTx } = await supabaseServer
    .from("revenue_transactions")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!lastTx || lastTx.length === 0 || lastTx[0].amount !== mrr) {
    await supabaseServer.from("revenue_transactions").insert({
      startup_id: startupId,
      amount: mrr,
      provider: providerName,
      source: providerName,
      currency: currency,
      // Just record a dummy external_id or use the last one
      external_id: recentPayments[0]?.external_payment_id
    });
  }

  // 4. Update aggregated revenue
  const aggregatedResult = await getAggregatedRevenue(Number(startupId));
  const snapshotRevenue = aggregatedResult?.totalRevenue ?? mrr;

  const { data: lastSnap } = await supabaseServer
    .from("revenue_snapshots")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!lastSnap || lastSnap[0]?.total_revenue !== snapshotRevenue) {
    await supabaseServer.from("revenue_snapshots").insert({
      startup_id: startupId,
      total_revenue: snapshotRevenue,
      provider_breakdown: aggregatedResult?.breakdown || { [providerName]: snapshotRevenue },
      provider: providerName,
      created_at: new Date().toISOString(),
    });
  }

  // 5. Update startup
  await supabaseServer
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

  // 6. Compute Trust Score
  await computeTrustScore(Number(startupId));

  return { 
    revenue: aggregatedResult?.totalRevenue ?? mrr, 
    breakdown: aggregatedResult?.breakdown, 
    currency, 
    total_transactions,
    payments: recentPayments
  };
}
