import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Missing Supabase Server environment variables (SUPABASE_SERVICE_ROLE_KEY). API calls will fail.");
}

/**
 * Supabase Server Client
 * Uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * MUST ONLY be used in server-side contexts (API routes, Server Actions).
 */
export const supabaseServer = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key"
);

/**
 * Legacy helper for Server Components.
 * Returns the same singleton instance.
 */
export function getSupabaseServer() {
  return supabaseServer;
}
