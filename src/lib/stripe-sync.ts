import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase-server";
import { encrypt } from "@/lib/encryption";
import { computeTrustScore } from "@/lib/scoring";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { detectFraud } from "@/lib/fraud";
import {
  getPlatformStripe,
  getStripeForSecretKey,
  isStripeConnectAccountId,
} from "@/lib/stripe";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export type StripeVerificationResult = {
  revenue: number;
  breakdown: Record<string, number>;
  currency: string;
  total_transactions: number;
  connection_type: "connect" | "api_key";
};

type StripeRequestOptions = { stripeAccount?: string };

async function listRecentBalanceTransactions(
  stripe: Stripe,
  requestOptions?: StripeRequestOptions
): Promise<Stripe.BalanceTransaction[]> {
  const from = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
  const collected: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.balanceTransactions.list(
      {
        created: { gte: from },
        limit: 100,
        starting_after: startingAfter,
      },
      requestOptions
    );

    collected.push(...page.data);
    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    } else {
      break;
    }
  }

  return collected.filter(
    (tx) => tx.type === "charge" || tx.type === "payment"
  );
}

export async function upsertStripeBalanceTransactions(
  startupId: number,
  transactions: Stripe.BalanceTransaction[]
): Promise<number> {
  let synced = 0;

  for (const tx of transactions) {
    const { error } = await supabaseServer.from("revenue_transactions").upsert(
      {
        startup_id: startupId,
        provider: "stripe",
        amount: tx.amount / 100,
        currency: (tx.currency || "usd").toUpperCase(),
        status: "captured",
        external_id: tx.id,
        payment_id: tx.id,
        created_at: new Date(tx.created * 1000).toISOString(),
      },
      { onConflict: "external_id" }
    );
    if (!error) synced++;
  }

  return synced;
}

export async function saveStripeConnection(params: {
  startupId: number;
  accountId: string;
  encryptedCredential: string;
  latestRevenue?: number;
}): Promise<void> {
  const { error } = await supabaseServer.from("provider_connections").upsert(
    {
      startup_id: params.startupId,
      provider: "stripe",
      account_id: params.accountId,
      api_key_encrypted: params.encryptedCredential,
      status: "connected",
      latest_revenue: params.latestRevenue ?? 0,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "startup_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to save Stripe connection: ${error.message}`);
  }

  await supabaseServer
    .from("startup_submissions")
    .update({
      stripe_account_id: isStripeConnectAccountId(params.accountId)
        ? params.accountId
        : null,
      payment_connected: true,
    })
    .eq("id", params.startupId);
}

async function runFraudChecks(
  startupId: number,
  transactions: Stripe.BalanceTransaction[]
): Promise<boolean> {
  const amounts = transactions.map((tx) => tx.amount / 100);
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
      description: "Revenue spike detected via Stripe verification",
    });
    return true;
  }

  return false;
}

export async function completeStripeVerification(
  startupId: number,
  options?: {
    stripe?: Stripe;
    stripeAccountId?: string;
    connectionType: "connect" | "api_key";
  }
): Promise<StripeVerificationResult> {
  const stripe =
    options?.stripe ??
    (options?.stripeAccountId
      ? getPlatformStripe()
      : null);

  if (!stripe) {
    throw new Error("Stripe client is required for verification sync");
  }

  const requestOptions = options?.stripeAccountId
    ? { stripeAccount: options.stripeAccountId }
    : undefined;

  const transactions = await listRecentBalanceTransactions(
    stripe,
    requestOptions
  );

  const revenue30d =
    transactions.reduce((sum, tx) => sum + tx.amount, 0) / 100;
  const currency =
    (transactions[0]?.currency || "usd").toUpperCase();
  const total_transactions = transactions.length;

  if (total_transactions === 0 || revenue30d === 0) {
    throw new Error("No revenue detected in the last 30 days");
  }

  const spikeDetected = await runFraudChecks(startupId, transactions);
  await upsertStripeBalanceTransactions(startupId, transactions);

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
        aggregated.breakdown || { stripe: snapshotRevenue },
      provider: "stripe",
      created_at: new Date().toISOString(),
    });
  }

  await supabaseServer
    .from("provider_connections")
    .update({
      latest_revenue: aggregated.breakdown?.stripe ?? revenue30d,
      last_synced_at: new Date().toISOString(),
      status: "connected",
    })
    .eq("startup_id", startupId)
    .eq("provider", "stripe");

  await supabaseServer
    .from("startup_submissions")
    .update({
      payment_connected: true,
      verification_status: "api_verified",
      last_verified_at: new Date().toISOString(),
      raw_metrics: {
        payment_count: total_transactions,
        spike_detected: spikeDetected,
        stripe_connection_type: options?.connectionType ?? "api_key",
      },
    })
    .eq("id", startupId);

  await computeTrustScore(startupId);

  await supabaseServer.from("verification_logs").insert({
    startup_id: startupId,
    event: "stripe_sync_success",
    metadata: {
      mrr: snapshotRevenue,
      count: total_transactions,
      connection_type: options?.connectionType ?? "api_key",
    },
  });

  return {
    revenue: snapshotRevenue,
    breakdown: aggregated.breakdown,
    currency,
    total_transactions,
    connection_type: options?.connectionType ?? "api_key",
  };
}

export async function verifyManualStripeApiKey(params: {
  apiKey: string;
  startupId: number;
}): Promise<StripeVerificationResult> {
  const stripe = getStripeForSecretKey(params.apiKey);

  try {
    await stripe.balanceTransactions.list({ limit: 1 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid Stripe API key";
    throw new Error(message);
  }

  await saveStripeConnection({
    startupId: params.startupId,
    accountId: "sk_manual",
    encryptedCredential: encrypt(params.apiKey),
  });

  return completeStripeVerification(params.startupId, {
    stripe,
    connectionType: "api_key",
  });
}

export async function verifyStripeConnectAccount(params: {
  startupId: number;
  stripeAccountId: string;
  refreshToken?: string;
}): Promise<StripeVerificationResult> {
  if (!isStripeConnectAccountId(params.stripeAccountId)) {
    throw new Error("Invalid Stripe Connect account id");
  }

  const credential = encrypt(params.refreshToken || "stripe_connect");

  await saveStripeConnection({
    startupId: params.startupId,
    accountId: params.stripeAccountId,
    encryptedCredential: credential,
  });

  return completeStripeVerification(params.startupId, {
    stripe: getPlatformStripe(),
    stripeAccountId: params.stripeAccountId,
    connectionType: "connect",
  });
}

export async function resyncExistingStripeConnection(
  startupId: number
): Promise<StripeVerificationResult> {
  const { data: conn, error } = await supabaseServer
    .from("provider_connections")
    .select("*")
    .eq("startup_id", startupId)
    .eq("provider", "stripe")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !conn) {
    throw new Error("No active Stripe connection found for this startup");
  }

  if (isStripeConnectAccountId(conn.account_id)) {
    return completeStripeVerification(startupId, {
      stripe: getPlatformStripe(),
      stripeAccountId: conn.account_id,
      connectionType: "connect",
    });
  }

  const { decrypt } = await import("@/lib/encryption");
  const apiKey = decrypt(conn.api_key_encrypted);
  return completeStripeVerification(startupId, {
    stripe: getStripeForSecretKey(apiKey),
    connectionType: "api_key",
  });
}
