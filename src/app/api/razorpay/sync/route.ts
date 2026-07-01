import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { resyncExistingRazorpayConnection } from "@/lib/razorpay-sync";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Re-sync revenue for an existing Razorpay connection.
 * POST /api/razorpay/sync  { startup_id }
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { startup_id } = await req.json();
    const startupId = Number(startup_id);

    if (!Number.isFinite(startupId)) {
      return NextResponse.json(
        { success: false, error: "Missing startup_id" },
        { status: 400 }
      );
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user!.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required for manual sync" },
        { status: 403 }
      );
    }

    const result = await resyncExistingRazorpayConnection(startupId);

    return NextResponse.json({
      success: true,
      mrr: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
    });
  } catch (err: any) {
    const { getFriendlyErrorMessage } = await import("@/lib/providers/error-mapping");
    const isProviderError = err && err.name === "ProviderError";
    const message = getFriendlyErrorMessage("razorpay", err);
    
    // Ensure logs contain the full structured object
    console.error("[Razorpay Sync] Error:", isProviderError ? (err.originalError || err) : err);

    const body = await req.clone().json().catch(() => ({}));
    if (body.startup_id) {
      await supabaseServer.from("verification_logs").insert({
        startup_id: Number(body.startup_id),
        event: "razorpay_sync_failure",
        metadata: { error: message },
      });
    }

    const status = isProviderError && err.statusCode !== 500
      ? err.statusCode
      : (message.includes("No active") ? 404 : 500);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
