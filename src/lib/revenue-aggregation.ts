import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt } from "@/lib/encryption";

// ─── Types ─────────────────────────────────────────────────────────────

/** Normalized revenue result from any single provider */
export type ProviderRevenue = {
  provider: string;
  revenue: number;         // base currency (rupees / dollars)
  currency: string;        // normalized to "INR"
  transactionCount: number;
  success: boolean;
  error?: string;
};

/** Aggregated revenue across all connected providers */
export type AggregatedRevenue = {
  totalRevenue: number;
  breakdown: Record<string, number>;
  providers: ProviderRevenue[];
};

// ─── Provider Fetchers ─────────────────────────────────────────────────

/**
 * Fetches last-30-day revenue from Stripe via balance_transactions.
 * Returns a normalized { revenue, currency: "INR" } shape.
 */
export async function getStripeRevenue(apiKey: string): Promise<ProviderRevenue> {
  try {
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );

    const res = await fetch(
      `https://api.stripe.com/v1/balance_transactions?created[gte]=${thirtyDaysAgo}&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        provider: "stripe",
        revenue: 0,
        currency: "INR",
        transactionCount: 0,
        success: false,
        error: err?.error?.message || `Stripe API error: ${res.status}`,
      };
    }

    const data = await res.json();
    const charges = (data.data || []).filter(
      (t: any) => t.type === "charge" || t.type === "payment"
    );
    const totalCents = charges.reduce(
      (sum: number, t: any) => sum + (t.amount || 0),
      0
    );

    return {
      provider: "stripe",
      revenue: totalCents / 100,
      currency: "INR",
      transactionCount: charges.length,
      success: true,
    };
  } catch (err: any) {
    return {
      provider: "stripe",
      revenue: 0,
      currency: "INR",
      transactionCount: 0,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Fetches last-30-day revenue from Razorpay via payments API.
 * Returns a normalized { revenue, currency: "INR" } shape.
 */
export async function getRazorpayRevenue(
  keyId: string,
  keySecret: string
): Promise<ProviderRevenue> {
  try {
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );
    const now = Math.floor(Date.now() / 1000);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const res = await fetch(
      `https://api.razorpay.com/v1/payments?from=${thirtyDaysAgo}&to=${now}&count=100`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        provider: "razorpay",
        revenue: 0,
        currency: "INR",
        transactionCount: 0,
        success: false,
        error:
          err?.error?.description || `Razorpay API error: ${res.status}`,
      };
    }

    const data = await res.json();
    const captured = (data.items || []).filter(
      (p: any) => p.status === "captured"
    );
    const totalPaise = captured.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    );

    return {
      provider: "razorpay",
      revenue: totalPaise / 100,
      currency: "INR",
      transactionCount: captured.length,
      success: true,
    };
  } catch (err: any) {
    return {
      provider: "razorpay",
      revenue: 0,
      currency: "INR",
      transactionCount: 0,
      success: false,
      error: err.message,
    };
  }
}

// ─── Unified Aggregation Engine ────────────────────────────────────────

/**
 * THE single source of truth for startup revenue.
 *
 * 1. Fetches all connected providers from `provider_connections`
 * 2. Calls each provider's live API to get current 30-day revenue
 * 3. Normalizes every response to { revenue, currency: "INR" }
 * 4. Aggregates into a total + per-provider breakdown
 * 5. Persists `latest_revenue` per connection  &  `mrr` + `mrr_breakdown` on startup_submissions
 * 6. Returns { totalRevenue, breakdown, providers }
 *
 * Every route in the system MUST use this function instead of
 * calculating Stripe / Razorpay revenue independently.
 */
export async function getAggregatedRevenue(
  startupId: number
): Promise<AggregatedRevenue> {
  // ── 1. Fetch all connected providers ─────────────────────
  const { data: connections, error } = await supabaseAdmin
    .from("provider_connections")
    .select("*")
    .eq("startup_id", startupId)
    .eq("status", "connected");

  if (error) {
    console.error("[RevenueEngine] ERROR:", {
      startupId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return { totalRevenue: 0, breakdown: {}, providers: [] };
  }

  if (!connections || connections.length === 0) {
    return { totalRevenue: 0, breakdown: {}, providers: [] };
  }

  // ── 2. Fetch live revenue from each provider (parallel) ──
  const providerResults: ProviderRevenue[] = await Promise.all(
    connections.map(async (conn) => {
      const decryptedKey = decrypt(conn.api_key_encrypted);

      switch (conn.provider) {
        case "stripe":
          return getStripeRevenue(decryptedKey);

        case "razorpay":
          return getRazorpayRevenue(conn.account_id, decryptedKey);

        default:
          return {
            provider: conn.provider,
            revenue: 0,
            currency: "INR",
            transactionCount: 0,
            success: false,
            error: `Unsupported provider: ${conn.provider}`,
          } as ProviderRevenue;
      }
    })
  );

  // ── 3. Normalize + Aggregate ─────────────────────────────
  let totalRevenue = 0;
  const breakdown: Record<string, number> = {};

  for (const result of providerResults) {
    if (result.success) {
      totalRevenue += result.revenue;
      breakdown[result.provider] = result.revenue;
    } else {
      // Fallback to cached latest_revenue when a live call fails
      console.warn(
        `[RevenueEngine] ${result.provider} live fetch failed, using cache:`,
        result.error
      );
      const cached = connections.find((c) => c.provider === result.provider);
      if (cached?.latest_revenue) {
        const fallback = Number(cached.latest_revenue);
        totalRevenue += fallback;
        breakdown[result.provider] = fallback;
      }
    }
  }

  // ── 4. Persist per-provider latest_revenue ───────────────
  await Promise.all(
    providerResults
      .filter((r) => r.success)
      .map((result) =>
        supabaseAdmin
          .from("provider_connections")
          .update({
            latest_revenue: result.revenue,
            last_synced_at: new Date().toISOString(),
          })
          .eq("startup_id", startupId)
          .eq("provider", result.provider)
      )
  );

  // ── 5. Persist aggregated MRR to startup_submissions ─────
  await supabaseAdmin
    .from("startup_submissions")
    .update({
      mrr: Math.round(totalRevenue),
      mrr_breakdown: breakdown,
    })
    .eq("id", startupId);

  // ── 6. Persist historical snapshot if changed ─────────────
  const { data: lastSnapshot } = await supabaseAdmin
    .from("revenue_snapshots")
    .select("total_revenue, provider_breakdown")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const roundedTotal = Math.round(totalRevenue);
  const isChanged = !lastSnapshot || 
    Number(lastSnapshot.total_revenue) !== roundedTotal ||
    JSON.stringify(lastSnapshot.provider_breakdown) !== JSON.stringify(breakdown);

  if (isChanged) {
    await supabaseAdmin.from("revenue_snapshots").insert({
      startup_id: startupId,
      total_revenue: roundedTotal,
      provider_breakdown: breakdown
    });
  }

  return { totalRevenue, breakdown, providers: providerResults };
}

/**
 * Retrieves the historical MRR snapshots for a startup.
 * Useful for calculating MoM growth and drawing charts.
 */
export async function getRevenueHistory(startupId: number) {
  const { data, error } = await supabaseAdmin
    .from("revenue_snapshots")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: true });
    
  if (error) {
    console.error("[RevenueEngine] ERROR:", {
      startupId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return [];
  }
  return data || [];
}

/**
 * Computes core business health metrics using the snapshot history.
 * Returns MRR, ARR, and Month-over-Month (Snapshot-over-Snapshot) growth.
 */
export async function getStartupMetrics(startupId: number) {
  const DEBUG = true;

  console.log("[RevenueEngine] Fetching from revenue_snapshots for:", startupId);

  const { data, error } = await supabaseAdmin
    .from("revenue_snapshots")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false });

  if (DEBUG) {
    console.log("[RevenueEngine DEBUG]", { data, error });
  }

  console.log("[RevenueEngine] Query result:", data);

  if (error) {
    console.error("[RevenueEngine] FULL ERROR OBJECT:", error);
    console.error("[RevenueEngine] STRINGIFIED:", JSON.stringify(error, null, 2));
    console.error("[RevenueEngine] STARTUP ID:", startupId);

    return {
      mrr: 0,
      arr: 0,
      growthPercentage: 0,
    };
  }

  if (!data || data.length === 0) {
    console.warn("[RevenueEngine] No snapshots found for:", startupId);

    return {
      mrr: 0,
      arr: 0,
      growthPercentage: 0,
    };
  }

  const latest = data[0];
  const previous = data[1];

  const mrr = latest.total_revenue || 0;
  const arr = mrr * 12;

  let growth = 0;

  if (previous && previous.total_revenue > 0) {
    growth = ((latest.total_revenue - previous.total_revenue) / previous.total_revenue) * 100;
  } else if (latest.total_revenue > 0 && (!previous || previous.total_revenue === 0)) {
    growth = 100;
  }

  const finalGrowth = Math.round(growth * 100) / 100;

  console.log("[RevenueEngine] FINAL METRICS:", {
    mrr,
    arr,
    growth: finalGrowth,
  });

  return {
    mrr,
    arr,
    growthPercentage: finalGrowth
  };
}
