/**
 * Centralized production-safe URL utility system.
 * 
 * 1. Production URL Handling:
 *    Always prioritize NEXT_PUBLIC_APP_URL if defined. In production environments
 *    (such as Vercel production hosting or custom VPS setups), this environment 
 *    variable must be configured with the canonical custom domain (e.g., https://verifi.com)
 *    to prevent protocol or subdomain dilution, ensuring SEO metadata and absolute sharing URLs 
 *    are structurally consistent and canonical.
 * 
 * 2. Vercel Deployment Usage:
 *    When deploying on Vercel, the environment variable NEXT_PUBLIC_APP_URL should be set in the 
 *    Vercel project settings for the Production environment. This guarantees that server-side and 
 *    client-side rendering matches, avoiding hydration mismatches caused by Vercel's ephemeral
 *    development/preview environment variables (like process.env.VERCEL_URL) during dynamic SSR tasks.
 * 
 * 3. Local Fallback Behavior:
 *    If NEXT_PUBLIC_APP_URL is not defined (for example, in local developer workspaces), 
 *    the helper defaults to "http://localhost:3000". This ensures the application works out-of-the-box
 *    for local runs (npm run dev) without any manual local setup files.
 */
export function getBaseUrl() {
  // 1. Prioritize configured canonical production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Prioritize Vercel system-defined environment variables for ephemeral previews and production fallbacks
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Prevent localhost fallback in actual production environments
  if (process.env.NODE_ENV === "production") {
    // If running on the client side, fallback gracefully to the active browser origin
    if (typeof window !== "undefined" && window?.location?.origin) {
      return window.location.origin;
    }
  }

  // 4. Default to local developer workspace
  return "http://localhost:3000";
}

/**
 * Reusable URL generation helper for a public startup profile.
 */
export function getStartupUrl(slug: string) {
  return `${getBaseUrl()}/startup/${slug}`;
}

/**
 * Reusable URL generation helper for a dynamic startup badge.
 */
export function getBadgeUrl(slug: string) {
  return `${getBaseUrl()}/api/badge/${slug}`;
}
