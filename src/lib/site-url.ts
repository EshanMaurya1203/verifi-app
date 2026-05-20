function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Canonical site origin for absolute URLs (embeds, OG, sitemap, auth redirects).
 * Production must set NEXT_PUBLIC_SITE_URL.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  }

  // Client: use the active origin when env is unset (e.g. local dev)
  if (typeof window !== "undefined" && window?.location?.origin) {
    return window.location.origin;
  }

  // Non-production server/preview fallbacks
  if (process.env.NODE_ENV !== "production") {
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
  }

  // Production without NEXT_PUBLIC_SITE_URL — avoid wrong hardcoded domains
  return "";
}

export function getStartupUrl(slug: string): string {
  const encoded = encodeURIComponent(slug);
  const base = getSiteUrl();
  return base ? `${base}/startup/${encoded}` : `/startup/${encoded}`;
}

/** Absolute badge URL for external embed snippets */
export function getBadgeUrl(slug: string): string {
  const encoded = encodeURIComponent(slug);
  const base = getSiteUrl();
  return base ? `${base}/api/badge/${encoded}` : `/api/badge/${encoded}`;
}

/** Same-origin badge URL for in-app preview (avoids cross-origin 404s) */
export function getRelativeBadgeUrl(slug: string): string {
  return `/api/badge/${encodeURIComponent(slug)}`;
}
