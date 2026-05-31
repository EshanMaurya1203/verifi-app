import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { verifyManualStripeApiKey } from "@/lib/stripe-sync";

/**
 * Stripe Verification API (/api/stripe/verify)
 * Manual secret-key connection (existing UI flow).
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { apiKey, startupId } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    if (!startupId) {
      return NextResponse.json({ error: "startupId is required" }, { status: 400 });
    }

    const { authenticated, owned } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const result = await verifyManualStripeApiKey({
      apiKey,
      startupId: Number(startupId),
    });

    return NextResponse.json({
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
      connection_type: result.connection_type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe verification failed";
    const isClientError =
      message.includes("No revenue") ||
      message.includes("Invalid") ||
      message.includes("required");

    console.error("[Stripe Verify] Error:", err);
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
