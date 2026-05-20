export function getSiteUrl(): string {
  // 1. Prioritize configured canonical production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Support Vercel ephemeral system variables for preview links (server-side & client-side)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Fallback dynamically on client to active browser origin
  if (typeof window !== "undefined" && window?.location?.origin) {
    return window.location.origin;
  }

  // 4. Prevent localhost fallback in actual production environments
  if (process.env.NODE_ENV === "production") {
    return "https://verifi.com"; // Standard absolute production fallback
  }

  // 5. Default to local developer workspace ONLY in development
  return "http://localhost:3000";
}

export function getStartupUrl(slug: string): string {
  return `${getSiteUrl()}/startup/${slug}`;
}

export function getBadgeUrl(slug: string): string {
  return `${getSiteUrl()}/api/badge/${slug}`;
}
