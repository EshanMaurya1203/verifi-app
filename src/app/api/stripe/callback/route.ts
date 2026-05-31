import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSiteUrl } from "@/lib/site-url";
import {
  exchangeStripeConnectCode,
  verifyStripeOAuthState,
} from "@/lib/stripe-connect";
import { verifyStripeConnectAccount } from "@/lib/stripe-sync";

function redirectWithStatus(
  slug: string | null,
  startupId: number,
  status: "success" | "error",
  message?: string
): NextResponse {
  const base = getSiteUrl();
  const path =
    slug && startupId > 0
      ? `/startup/${encodeURIComponent(slug)}/verify`
      : startupId > 0
        ? `/startup/${startupId}/verify`
        : "/submit";
  const params = new URLSearchParams({ stripe: status });
  if (message) params.set("stripe_error", message.slice(0, 200));

  const destination = base ? `${base}${path}?${params}` : `${path}?${params}`;
  return NextResponse.redirect(destination);
}

/**
 * Stripe Connect OAuth callback.
 * GET /api/stripe/callback?code=...&state=...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (error) {
    const message = errorDescription || error;
    const startupIdFromState = state ? verifyStripeOAuthState(state)?.startupId : null;
    return redirectWithStatus(
      null,
      startupIdFromState ?? 0,
      "error",
      message || "Stripe authorization was cancelled or denied"
    );
  }

  if (!code || !state) {
    return redirectWithStatus(null, 0, "error", "Missing OAuth code or state");
  }

  const parsed = verifyStripeOAuthState(state);
  if (!parsed) {
    return redirectWithStatus(null, 0, "error", "Invalid or expired OAuth state");
  }

  const { startupId } = parsed;

  const { data: startup } = await supabaseServer
    .from("startup_submissions")
    .select("slug, user_id")
    .eq("id", startupId)
    .maybeSingle();

  if (!startup || startup.user_id !== parsed.userId) {
    return redirectWithStatus(
      startup?.slug ?? null,
      startupId,
      "error",
      "Startup ownership validation failed"
    );
  }

  try {
    const token = await exchangeStripeConnectCode(code);

    await verifyStripeConnectAccount({
      startupId,
      stripeAccountId: token.stripe_user_id,
      refreshToken: token.refresh_token,
    });

    return redirectWithStatus(startup.slug, startupId, "success");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Stripe connection failed";
    console.error("[Stripe Connect] Callback error:", err);
    return redirectWithStatus(startup.slug, startupId, "error", message);
  }
}
