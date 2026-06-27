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

  const cookiesBefore = cookieStore.getAll().map(c => c.name);
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  const cookiesAfter = cookieStore.getAll().map(c => c.name);

  if (exchangeError) {
    console.error("====== SUPABASE OAUTH EXCHANGE FAILURE ======");
    console.error("1. Error Object:", exchangeError);
    console.error("2. JSON stringified:", JSON.stringify(exchangeError, null, 2));
    console.error("3. Request URL:", request.url);
    console.error("4. Request origin:", origin);
    console.error("5. Search params:", searchParams.toString());
    console.error("6. Code exists:", !!code);
    console.error("7. NEXT_PUBLIC_SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.error("8. NEXT_PUBLIC_SUPABASE_ANON_KEY exists:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.error("9. Cookies before exchange:\n" + JSON.stringify(cookiesBefore, null, 2));
    console.error("10. Cookies after exchange:\n" + JSON.stringify(cookiesAfter, null, 2));
    console.error("11. Error status:", (exchangeError as any).status);
    console.error("12. Error code:", (exchangeError as any).code);
    console.error("13. Error message:", exchangeError.message);
    console.error("14. Error name:", exchangeError.name);
    console.error("=============================================");

    return redirectTo("/submit?error=oauth_exchange_failed");
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/submit";
  return redirectTo(safeNext);
}
