import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { verifyRazorpayApiKeys } from "@/lib/razorpay-sync";

/**
 * Razorpay Verification API (/api/razorpay/verify)
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { key_id, key_secret, startup_id } = await req.json();

    if (!key_id || !key_secret || !startup_id) {
      return NextResponse.json(
        { success: false, error: "Missing keys or startup ID" },
        { status: 400 }
      );
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startup_id);
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
        { error: "Subscription required to connect integration" },
        { status: 403 }
      );
    }

    const result = await verifyRazorpayApiKeys({
      keyId: key_id,
      keySecret: key_secret,
      startupId: Number(startup_id),
    });

    return NextResponse.json({
      success: true,
      message: "Razorpay connected and initial sync complete",
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
    });
  } catch (err: any) {
    const isProviderError = err && err.name === "ProviderError";
    const message = err instanceof Error ? err.message : "Razorpay verification failed";
    const isClientError =
      message.includes("No revenue") ||
      message.includes("Invalid") ||
      message.includes("Missing");

    const status = isProviderError && err.statusCode !== 500
      ? err.statusCode
      : (isClientError ? 400 : 500);

    // Ensure logs contain the full structured object
    console.error("[Razorpay Verify] Error:", isProviderError ? (err.originalError || err) : err);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
