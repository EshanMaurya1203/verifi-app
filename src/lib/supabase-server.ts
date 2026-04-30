import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Server Client
 * Uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * MUST ONLY be used in server-side contexts (API routes, Server Actions).
 */
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Legacy helper for Server Components.
 * Returns the same singleton instance.
 */
export function getSupabaseServer() {
  return supabaseServer;
}
