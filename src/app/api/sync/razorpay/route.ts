import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  resyncExistingRazorpayConnection,
  verifyRazorpayApiKeys,
} from "@/lib/razorpay-sync";

/**
 * Revenue Sync API (/api/sync/razorpay)
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
    const key_id = body.key_id as string | undefined;
    const key_secret = body.key_secret as string | undefined;

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

    const result =
      key_id && key_secret
        ? await verifyRazorpayApiKeys({
            keyId: key_id,
            keySecret: key_secret,
            startupId,
          })
        : await resyncExistingRazorpayConnection(startupId);

    return NextResponse.json({
      success: true,
      message: "Razorpay connected and revenue sync complete",
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
    });
  } catch (err: any) {
    const isProviderError = err && err.name === "ProviderError";
    const message = err instanceof Error ? err.message : "Razorpay sync failed";
    const isClientError =
      message.includes("No revenue") ||
      message.includes("No active Razorpay") ||
      message.includes("Invalid");

    const status = isProviderError && err.statusCode !== 500
      ? err.statusCode
      : (isClientError ? 400 : 500);

    // Ensure logs contain the full structured object
    console.error("[SyncRazorpay] Error:", isProviderError ? (err.originalError || err) : err);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
