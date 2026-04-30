import { supabaseServer } from "@/lib/supabase-server";
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
  const { data: connections, error } = await supabaseServer
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
        supabaseServer
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
  await supabaseServer
    .from("startup_submissions")
    .update({
      mrr: Math.round(totalRevenue),
      mrr_breakdown: breakdown,
    })
    .eq("id", startupId);

  // ── 6. Persist historical snapshot if changed ─────────────
  const { data: lastSnapshot } = await supabaseServer
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
    await supabaseServer.from("revenue_snapshots").insert({
      startup_id: startupId,
      total_revenue: roundedTotal,
      provider_breakdown: breakdown,
      provider: "combined",
    });
    console.log("[RevenueEngine] Snapshot persisted:", { startupId, total_revenue: roundedTotal });
  } else {
    console.log("[RevenueEngine] Skipping duplicate snapshot — revenue unchanged");
  }

  return { totalRevenue, breakdown, providers: providerResults };
}

/**
 * Retrieves the historical MRR snapshots for a startup.
 * Useful for calculating MoM growth and drawing charts.
 */
export async function getRevenueHistory(startupId: number) {
  const { data, error } = await supabaseServer
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
  try {
    console.log("[RevenueEngine] Fetching metrics for:", startupId);

    const { data, error } = await supabaseServer
      .from("revenue_snapshots")
      .select("*")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: false });

    // 🔴 REAL ERROR LOGGING
    if (error) {
      console.error("[RevenueEngine] SUPABASE ERROR:", error);
      console.error("[RevenueEngine] ERROR STRING:", JSON.stringify(error, null, 2));

      return {
        mrr: 0,
        arr: 0,
        growthPercentage: 0,
      };
    }

    console.log("[RevenueEngine] RAW DATA:", data);

    // 🟡 EMPTY DATA CASE (MOST IMPORTANT FIX)
    if (!data || data.length === 0) {
      console.warn("[RevenueEngine] No revenue snapshots found for:", startupId);

      return {
        mrr: 0,
        arr: 0,
        growthPercentage: 0,
      };
    }

    // ✅ SAFE ACCESS
    const latest = data[0];
    const previous = data.find(
      (d) => new Date(d.created_at) < new Date(latest.created_at)
    ) || null;

    console.log("[Snapshots]", data);
    console.log("[Latest vs Previous]", { latest, previous });

    const mrr = latest?.total_revenue ?? 0;
    const arr = mrr * 12;

    let growthPercentage = 0;

    if (previous && previous.total_revenue > 0) {
      growthPercentage =
        ((latest.total_revenue - previous.total_revenue) /
          previous.total_revenue) *
        100;
    }

    console.log("[RevenueEngine] FINAL METRICS:", {
      startupId,
      mrr,
      arr,
      growthPercentage,
    });

    return {
      mrr,
      arr,
      growthPercentage,
    };
  } catch (err) {
    console.error("[RevenueEngine] CRITICAL CRASH:", err);

    return {
      mrr: 0,
      arr: 0,
      growthPercentage: 0,
    };
  }
}
