import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Supabase OAuth callback — exchanges PKCE code for a session stored in cookies.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/submit";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (error) {
    const message = encodeURIComponent(errorDescription || error);
    return redirectTo(`/submit?error=${message}`);
  }

  if (!code) {
    return redirectTo("/submit?error=missing_oauth_code");
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
            // setAll from Server Component context
          }
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession:", exchangeError.message);
    return redirectTo("/submit?error=oauth_exchange_failed");
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/submit";
  return redirectTo(safeNext);
}
