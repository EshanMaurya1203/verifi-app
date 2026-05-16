/**
 * Centralized production-safe URL handling.
 * Returns the base URL for the application, prioritizing NEXT_PUBLIC_APP_URL.
 */
export function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Client-side: use the current window origin
    return window.location.origin;
  }

  // Server-side: use environment variable or fallback
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel deployment detection
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback for local development
  return "http://localhost:3000";
}

/**
 * Generates a public startup profile URL.
 */
export function getStartupUrl(slug: string) {
  return `${getBaseUrl()}/startup/${slug}`;
}

/**
 * Generates a public badge URL for a startup.
 */
export function getBadgeUrl(slug: string) {
  return `${getBaseUrl()}/api/badge/${slug}`;
}
