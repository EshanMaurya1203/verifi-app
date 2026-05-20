import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { createClient, User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    // 1. Try Authorization Bearer header first (API clients / developer tests)
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) return user;
      }
    }

    // 2. Fallback to browser cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
              // Ignore set errors in read context
            }
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error("[getAuthenticatedUser] Exception verifying user:", err);
    return null;
  }
}

export interface OwnershipVerificationResult {
  authenticated: boolean;
  owned: boolean;
  user: User | null;
  startup: any | null;
  isDemo: boolean;
}

export async function verifyStartupOwnership(
  startupIdOrSlug: string | number
): Promise<OwnershipVerificationResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { authenticated: false, owned: false, user: null, startup: null, isDemo: false };
  }

  let query = supabaseServer.from("startup_submissions").select("*");
  if (typeof startupIdOrSlug === "number" || !isNaN(Number(startupIdOrSlug))) {
    query = query.eq("id", Number(startupIdOrSlug));
  } else {
    query = query.eq("slug", startupIdOrSlug);
  }

  const { data: startup, error } = await query.maybeSingle();
  if (error || !startup) {
    return { authenticated: true, owned: false, user, startup: null, isDemo: false };
  }

  const isDemo = startup.user_id?.startsWith("00000000-0000-0000-0000-") || false;
  if (isDemo) {
    // Demo/sandbox profiles are public pre-seeded data; we prevent any modifications to them in production
    return { authenticated: true, owned: false, user, startup, isDemo };
  }

  const owned = startup.user_id === user.id;
  return { authenticated: true, owned, user, startup, isDemo };
}
