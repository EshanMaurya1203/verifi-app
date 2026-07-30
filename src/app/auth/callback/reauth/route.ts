import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  signReauthProof,
  verifyReauthIntent,
  REAUTH_PROOF_COOKIE_NAME,
  REAUTH_PROOF_TTL_SECONDS,
} from "@/lib/reauth-proof";

/**
 * Dedicated Supabase OAuth callback route for Re-authentication workflows.
 * Exchanges PKCE code for a session, validates the re-authentication action intent via HMAC verification,
 * generates a short-lived HMAC-signed re-authentication proof token, and sets it
 * as an HttpOnly cookie before redirecting to the confirmation page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intentToken = searchParams.get("intent");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const redirectToSettingsWithError = (errCode: string) => {
    const targetUrl = new URL("/dashboard/settings", origin);
    targetUrl.searchParams.set("error", errCode);
    return NextResponse.redirect(targetUrl);
  };

  if (error) {
    console.error("[OAuth Reauth Callback] Provider error:", errorDescription || error);
    return redirectToSettingsWithError(encodeURIComponent(errorDescription || error));
  }

  if (!code) {
    return redirectToSettingsWithError("missing_oauth_code");
  }

  // Validate the deletion action intent using server-signed HMAC verification
  const { valid: intentValid, action, reason: intentReason } = verifyReauthIntent(intentToken);
  if (!intentValid || !action) {
    console.error("[OAuth Reauth Callback] Invalid action intent:", intentReason);
    return redirectToSettingsWithError("invalid_reauth_action");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read context fallback
          }
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[OAuth Reauth Callback] Code exchange failed:", exchangeError);
    return redirectToSettingsWithError("oauth_exchange_failed");
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("[OAuth Reauth Callback] User retrieval failed:", userError);
    return redirectToSettingsWithError("unauthenticated");
  }

  // Create HMAC-signed re-authentication proof
  let proofToken: string;
  try {
    proofToken = signReauthProof(user.id, action);
  } catch (err: any) {
    console.error("[OAuth Reauth Callback] Failed to sign proof token:", err.message);
    return redirectToSettingsWithError("reauth_token_error");
  }

  // Create response redirecting to the confirmation page
  const confirmUrl = new URL("/dashboard/settings/confirm-delete", origin);
  confirmUrl.searchParams.set("action", action);
  const response = NextResponse.redirect(confirmUrl);

  // Attach HttpOnly cookie containing the short-lived reauth proof token (configurable maxAge)
  response.cookies.set(REAUTH_PROOF_COOKIE_NAME, proofToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/dashboard/settings/confirm-delete",
    maxAge: REAUTH_PROOF_TTL_SECONDS,
  });

  return response;
}
