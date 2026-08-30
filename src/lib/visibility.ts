/**
 * Visibility — Publication eligibility logic for startup profiles.
 *
 * Central source of truth for whether a startup meets the platform's
 * minimum requirements to appear on public surfaces (leaderboard, sitemap,
 * profiles, search engines, OG images, badges, etc.).
 *
 * Add new publication rules here — API routes never need to change.
 */

import { isDemoStartupUserId } from "./verification-data";

export interface PublicationEligibility {
  /** Whether the startup satisfies all publication requirements. */
  eligible: boolean;
  /** Human-readable reason when ineligible (safe to return to the client). */
  reason: string | null;
}

/**
 * Determines whether a startup is allowed to have `is_public = true`.
 *
 * A founder can always *hide* their profile (`is_public = false`), but they
 * may only *publish* it when every requirement below is satisfied.
 *
 * Current requirements:
 *   1. `verification_status` must not be `flagged`.
 *   2. `user_id` must not be a demo/sandbox profile in production.
 *   3. `payment_connected` must be `true`.
 */
export function canStartupBePublic(startup: {
  payment_connected?: boolean | null;
  verification_status?: string | null;
  user_id?: string | null;
  [key: string]: unknown;
}): PublicationEligibility {
  // Requirement 1: Not flagged
  if (startup.verification_status === "flagged") {
    return {
      eligible: false,
      reason: "This startup profile is currently restricted from public view.",
    };
  }

  // Requirement 2: Not a demo/sandbox profile
  if (isDemoStartupUserId(startup.user_id)) {
    return {
      eligible: false,
      reason: "Demo and sandbox startup profiles cannot be published.",
    };
  }

  // Requirement 3: At least one payment provider must be connected.
  if (!startup.payment_connected) {
    return {
      eligible: false,
      reason:
        "Your startup must have a verified payment provider connected before it can appear publicly on Verifii.",
    };
  }

  // All requirements met.
  return { eligible: true, reason: null };
}
