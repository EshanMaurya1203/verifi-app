import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith("sb-") || name.includes("auth-token") || name.includes("supabase");
}

function isUnrecoverableAuthError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode;
  const name = error.name || "";
  const message = (error.message || "").toLowerCase();

  // Network or 5xx server errors are transient — do NOT treat as unrecoverable auth failure
  if (
    (typeof status === "number" && status >= 500) ||
    name === "FetchError" ||
    name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("timeout")
  ) {
    return false;
  }

  // Explicit 4xx authentication / authorization error statuses
  if (typeof status === "number" && (status === 400 || status === 401 || status === 422)) {
    return true;
  }

  // Supabase AuthApiError
  if (name === "AuthApiError") {
    return true;
  }

  // Specific unrecoverable token / session error message strings
  const unrecoverableSubstrings = [
    "invalid refresh token",
    "refresh_token_not_found",
    "jwt expired",
    "token has expired",
    "invalid claim",
    "user_not_found",
    "session_not_found",
    "grant_type_invalid",
    "invalid grant",
  ];

  return unrecoverableSubstrings.some((term) => message.includes(term));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  // If user is unauthenticated due to an unrecoverable auth error (e.g. invalid/expired/revoked refresh token),
  // clear all stale Supabase auth cookies to prevent zombie session states and repeated failed refresh attempts.
  if (!user && isUnrecoverableAuthError(error)) {
    const allCookies = request.cookies.getAll();
    const authCookies = allCookies.filter((c) => isSupabaseAuthCookie(c.name));

    if (authCookies.length > 0) {
      authCookies.forEach(({ name }) => {
        try {
          request.cookies.delete(name);
        } catch {
          // Ignore request cookie mutation errors
        }
        supabaseResponse.cookies.set(name, "", {
          maxAge: 0,
          path: "/",
          expires: new Date(0),
        });
      });
    }
  }

  return supabaseResponse;
}

