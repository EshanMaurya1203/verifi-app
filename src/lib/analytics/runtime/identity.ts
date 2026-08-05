// ─── VRF-ONBOARD-002Y — Cross-Page Session Identity Layer ───────────────

import { murmur3_32 } from "../hash";

export interface IdentityContext {
  anonymousId?: string;
  userId?: string;
  userAgent?: string;
}

/**
 * Generates a unified identity ID from an IdentityContext.
 *
 * Priority Order:
 * 1. userId (if present and non-empty)
 * 2. anonymousId (if present and non-empty)
 * 3. userAgent (hashed fallback)
 *
 * Rules:
 * - Same identity input → same ID
 * - Different identity input → different ID
 */
export function generateIdentityId(context: IdentityContext): string {
  if (context && context.userId && typeof context.userId === "string" && context.userId.trim() !== "") {
    return `usr_${context.userId.trim()}`;
  }

  if (context && context.anonymousId && typeof context.anonymousId === "string" && context.anonymousId.trim() !== "") {
    return `anon_${context.anonymousId.trim()}`;
  }

  const userAgent = (context && context.userAgent && typeof context.userAgent === "string" && context.userAgent.trim() !== "")
    ? context.userAgent.trim()
    : "unknown_agent";

  const rawHash = murmur3_32(userAgent).toString(16).padStart(8, "0");
  return `ua_${rawHash}`;
}
