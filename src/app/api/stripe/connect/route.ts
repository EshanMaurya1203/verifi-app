import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  buildStripeConnectAuthorizeUrl,
  signStripeOAuthState,
} from "@/lib/stripe-connect";

/**
 * Starts Stripe Connect OAuth (read-only).
 * GET /api/stripe/connect?startup_id={id}
 */
export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startupIdRaw = searchParams.get("startup_id");
    const startupId = Number(startupIdRaw);

    if (!startupIdRaw || !Number.isFinite(startupId)) {
      return NextResponse.json({ error: "startup_id is required" }, { status: 400 });
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startupId);
    if (!authenticated || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const state = signStripeOAuthState({ startupId, userId: user.id });
    const authorizeUrl = buildStripeConnectAuthorizeUrl(state);

    return NextResponse.redirect(authorizeUrl);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unable to start Stripe Connect";
    console.error("[Stripe Connect] Start error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
