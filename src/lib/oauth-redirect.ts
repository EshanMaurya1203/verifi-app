import { getSiteUrl } from "@/lib/site-url";

/** Absolute URL for Supabase OAuth redirects (requires full origin). */
export function getClientOAuthRedirect(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${normalized}`;
  }

  const base = getSiteUrl();
  return base ? `${base}${normalized}` : normalized;
}
