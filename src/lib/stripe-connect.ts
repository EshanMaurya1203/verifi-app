import crypto from "crypto";
import { getSiteUrl } from "@/lib/site-url";
import { requireStripeSecretKey } from "@/lib/stripe";

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

function oauthStateSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is not configured");
  }
  return secret;
}

export function getStripeConnectRedirectUri(): string {
  const base = getSiteUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for Stripe Connect redirects");
  }
  return `${base}/api/stripe/callback`;
}

export function signStripeOAuthState(payload: {
  startupId: number;
  userId: string;
}): string {
  const issuedAt = Date.now();
  const body = `${payload.startupId}:${payload.userId}:${issuedAt}`;
  const sig = crypto
    .createHmac("sha256", oauthStateSecret())
    .update(body)
    .digest("hex");
  return Buffer.from(`${body}:${sig}`).toString("base64url");
}

export function verifyStripeOAuthState(
  state: string
): { startupId: number; userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [startupIdRaw, userId, issuedAtRaw, sig] = parts;
    const body = `${startupIdRaw}:${userId}:${issuedAtRaw}`;
    const expected = crypto
      .createHmac("sha256", oauthStateSecret())
      .update(body)
      .digest("hex");

    if (sig !== expected) return null;

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > OAUTH_STATE_TTL_MS) {
      return null;
    }

    const startupId = Number(startupIdRaw);
    if (!Number.isFinite(startupId) || !userId) return null;

    return { startupId, userId };
  } catch {
    return null;
  }
}

export function buildStripeConnectAuthorizeUrl(state: string): string {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRIPE_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    redirect_uri: getStripeConnectRedirectUri(),
    state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export type StripeOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  stripe_user_id: string;
  scope?: string;
  livemode?: boolean;
};

export async function exchangeStripeConnectCode(
  code: string
): Promise<StripeOAuthTokenResponse> {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRIPE_CLIENT_ID is not configured");
  }

  const body = new URLSearchParams({
    client_secret: requireStripeSecretKey(),
    client_id: clientId,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data?.error_description === "string"
        ? data.error_description
        : typeof data?.error === "string"
          ? data.error
          : "Stripe OAuth token exchange failed";
    throw new Error(message);
  }

  if (!data.stripe_user_id || !data.access_token) {
    throw new Error("Stripe OAuth response missing account credentials");
  }

  return data as StripeOAuthTokenResponse;
}
