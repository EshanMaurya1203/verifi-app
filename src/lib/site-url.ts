export function getSiteUrl(): string {
  // 1. Prioritize configured canonical production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Prevent localhost fallback in actual production environments
  if (process.env.NODE_ENV === "production") {
    // If running on the client side, fallback gracefully to the active browser origin
    if (typeof window !== "undefined" && window?.location?.origin) {
      return window.location.origin;
    }
    // Fallback for production server-side without env var
    return "https://verifi.com"; // Placeholder, but better than localhost
  }

  // 3. Default to local developer workspace ONLY in development
  return "http://localhost:3000";
}

export function getStartupUrl(slug: string): string {
  return `${getSiteUrl()}/startup/${slug}`;
}

export function getBadgeUrl(slug: string): string {
  return `${getSiteUrl()}/api/badge/${slug}`;
}
