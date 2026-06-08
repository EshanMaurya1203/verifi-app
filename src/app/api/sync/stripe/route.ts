import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  resyncExistingStripeConnection,
  verifyManualStripeApiKey,
} from "@/lib/stripe-sync";

/**
 * Revenue Sync API (/api/sync/stripe)
 * Re-syncs an existing connection or connects via manual API key.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const startupId = Number(body.startup_id ?? body.startupId);
    const apiKey = body.apiKey as string | undefined;

    if (!Number.isFinite(startupId)) {
      return NextResponse.json(
        { success: false, error: "startup_id is required" },
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

    const result = apiKey
      ? await verifyManualStripeApiKey({ apiKey, startupId })
      : await resyncExistingStripeConnection(startupId);

    return NextResponse.json({
      success: true,
      message: "Stripe connected and revenue sync complete",
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
      connection_type: result.connection_type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe sync failed";
    const isClientError =
      message.includes("No revenue") ||
      message.includes("No active Stripe") ||
      message.includes("Invalid");

    console.error("[SyncStripe] Error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
