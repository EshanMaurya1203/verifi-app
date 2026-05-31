import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase-server";
import { encrypt, decrypt } from "@/lib/encryption";
import { computeTrustScore } from "@/lib/scoring";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { detectFraud } from "@/lib/fraud";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export type RazorpayCapturedPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
};

export type RazorpayVerificationResult = {
  revenue: number;
  breakdown: Record<string, number>;
  currency: string;
  total_transactions: number;
};

export function createRazorpayClient(keyId: string, keySecret: string): Razorpay {
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function fetchRazorpayCapturedPayments(
  razorpay: Razorpay
): Promise<RazorpayCapturedPayment[]> {
  const from = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
  const to = Math.floor(Date.now() / 1000);
  const collected: RazorpayCapturedPayment[] = [];
  let skip = 0;
  const pageSize = 100;

  while (true) {
    const response = await razorpay.payments.all({
      from,
      to,
      count: pageSize,
      skip,
    });

    const items = response?.items || [];
    if (items.length === 0) break;

    for (const p of items) {
      if (p.status !== "captured") continue;
      collected.push({
        id: p.id,
        amount: Number(p.amount) || 0,
        currency: p.currency || "INR",
        status: p.status,
        created_at: Number(p.created_at) || 0,
      });
    }

    if (items.length < pageSize) break;
    skip += pageSize;
  }

  return collected;
}

export async function saveRazorpayConnection(params: {
  startupId: number;
  keyId: string;
  keySecret: string;
  latestRevenue?: number;
}): Promise<void> {
  const { error } = await supabaseServer.from("provider_connections").upsert(
    {
      startup_id: params.startupId,
      provider: "razorpay",
      account_id: params.keyId,
      api_key_encrypted: encrypt(params.keySecret),
      status: "connected",
      latest_revenue: params.latestRevenue ?? 0,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "startup_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to save Razorpay connection: ${error.message}`);
  }

  await supabaseServer
    .from("startup_submissions")
    .update({ payment_connected: true })
    .eq("id", params.startupId);
}

export async function upsertRazorpayPayments(
  startupId: number,
  payments: RazorpayCapturedPayment[]
): Promise<number> {
  let synced = 0;

  for (const p of payments) {
    const { error } = await supabaseServer.from("revenue_transactions").upsert(
      {
        startup_id: startupId,
        provider: "razorpay",
        amount: p.amount / 100,
        currency: (p.currency || "INR").toUpperCase(),
        status: p.status,
        external_id: p.id,
        payment_id: p.id,
        created_at: new Date(p.created_at * 1000).toISOString(),
      },
      { onConflict: "external_id" }
    );
    if (!error) synced++;
  }

  return synced;
}

async function runFraudChecks(
  startupId: number,
  payments: RazorpayCapturedPayment[]
): Promise<boolean> {
  const amounts = payments.map((p) => p.amount / 100);
  const currentMaxTx = amounts.length > 0 ? Math.max(...amounts) : 0;

  const { data: history } = await supabaseServer
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(4);

  const fraud = detectFraud({
    amount: currentMaxTx,
    previousTransactions: (history ?? []).map((h) => Number(h.amount)),
    timestamps: (history ?? []).map((h) => new Date(h.created_at).getTime()),
    now: Date.now(),
  });

  if (fraud.reason === "spike") {
    await supabaseServer.from("fraud_signals").insert({
      startup_id: startupId,
      signal_type: "REVENUE_SPIKE",
      severity: 3,
      description: "Revenue spike detected via Razorpay verification",
    });
    return true;
  }

  return false;
}

export async function completeRazorpayVerification(
  startupId: number,
  razorpay: Razorpay
): Promise<RazorpayVerificationResult> {
  const payments = await fetchRazorpayCapturedPayments(razorpay);
  const revenue30d = payments.reduce((sum, p) => sum + p.amount, 0) / 100;
  const currency = (payments[0]?.currency || "INR").toUpperCase();
  const total_transactions = payments.length;

  if (total_transactions === 0 || revenue30d === 0) {
    throw new Error("No revenue detected in the last 30 days");
  }

  const spikeDetected = await runFraudChecks(startupId, payments);
  await upsertRazorpayPayments(startupId, payments);

  const aggregated = await getAggregatedRevenue(startupId);
  const snapshotRevenue = aggregated.totalRevenue ?? revenue30d;

  const { data: lastSnap } = await supabaseServer
    .from("revenue_snapshots")
    .select("total_revenue")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!lastSnap?.length || lastSnap[0]?.total_revenue !== snapshotRevenue) {
    await supabaseServer.from("revenue_snapshots").insert({
      startup_id: startupId,
      total_revenue: snapshotRevenue,
      provider_breakdown:
        aggregated.breakdown || { razorpay: snapshotRevenue },
      provider: "razorpay",
      created_at: new Date().toISOString(),
    });
  }

  await supabaseServer
    .from("provider_connections")
    .update({
      latest_revenue: aggregated.breakdown?.razorpay ?? revenue30d,
      last_synced_at: new Date().toISOString(),
      status: "connected",
    })
    .eq("startup_id", startupId)
    .eq("provider", "razorpay");

  await supabaseServer
    .from("startup_submissions")
    .update({
      payment_connected: true,
      verification_status: "api_verified",
      last_verified_at: new Date().toISOString(),
      raw_metrics: {
        payment_count: total_transactions,
        spike_detected: spikeDetected,
      },
    })
    .eq("id", startupId);

  await computeTrustScore(startupId);

  await supabaseServer.from("verification_logs").insert({
    startup_id: startupId,
    event: "razorpay_sync_success",
    metadata: { mrr: snapshotRevenue, count: total_transactions },
  });

  return {
    revenue: snapshotRevenue,
    breakdown: aggregated.breakdown,
    currency,
    total_transactions,
  };
}

export async function verifyRazorpayApiKeys(params: {
  keyId: string;
  keySecret: string;
  startupId: number;
}): Promise<RazorpayVerificationResult> {
  const razorpay = createRazorpayClient(params.keyId, params.keySecret);

  try {
    await razorpay.payments.all({ count: 1 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid Razorpay API keys";
    throw new Error(message);
  }

  await saveRazorpayConnection({
    startupId: params.startupId,
    keyId: params.keyId,
    keySecret: params.keySecret,
  });

  return completeRazorpayVerification(params.startupId, razorpay);
}

export async function resyncExistingRazorpayConnection(
  startupId: number
): Promise<RazorpayVerificationResult> {
  const { data: conn, error } = await supabaseServer
    .from("provider_connections")
    .select("*")
    .eq("startup_id", startupId)
    .eq("provider", "razorpay")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !conn?.account_id || !conn.api_key_encrypted) {
    throw new Error("No active Razorpay connection found for this startup");
  }

  const keySecret = decrypt(conn.api_key_encrypted);
  const razorpay = createRazorpayClient(conn.account_id, keySecret);
  return completeRazorpayVerification(startupId, razorpay);
}

export function resolveStartupIdFromRazorpayPaymentNotes(
  notes?: Record<string, string | undefined>
): number | null {
  const raw = notes?.startup_id;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}
