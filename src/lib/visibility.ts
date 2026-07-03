/**
 * Visibility — Publication eligibility logic for startup profiles.
 *
 * Central source of truth for whether a startup meets the platform's
 * minimum requirements to appear on public surfaces (leaderboard, sitemap,
 * profiles, search engines, OG images, badges, etc.).
 *
 * Add new publication rules here — API routes never need to change.
 */

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
 *   1. `payment_connected` must be `true`.
 *
 * Future requirements (e.g., identity verification, minimum trust score)
 * should be added as additional checks in this function.
 */
export function canStartupBePublic(startup: {
  payment_connected?: boolean | null;
  [key: string]: unknown;
}): PublicationEligibility {
  // Requirement 1: At least one payment provider must be connected.
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
