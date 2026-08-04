/**
 * VRF-ONBOARD-001E.9B — Diagnostics Threshold Configuration
 *
 * Centralized source of truth for all diagnostic constants and threshold timings.
 * No hardcoded magic numbers inside analytics calculation logic.
 */

/**
 * Inactivity window (ms) after which events for the same user are split into a new journey session.
 * Default: 24 hours (86,400,000 ms).
 */
export const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * If a second "onboarding_started" event occurs within this window (ms),
 * treat it as part of the same journey (e.g. refresh, double-click) instead of creating a new one.
 * If a second "onboarding_started" event occurs after this window, treat it as a deliberate new attempt.
 * Default: 10 minutes (600,000 ms).
 */
export const RESTART_WINDOW_MS = 10 * 60 * 1000;

/**
 * Time threshold (ms) of inactivity before an in-progress journey is classified as "stuck".
 * Default: 24 hours (86,400,000 ms).
 */
export const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum reasonable step duration (ms) for transition analytics.
 * Step transitions exceeding this threshold are treated as idle time and excluded from slow-step calculations.
 * Default: 2 hours (7,200,000 ms).
 */
export const MAX_STEP_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Cache TTL (ms) for Diagnostics API endpoints.
 * Default: 5 minutes (300,000 ms).
 */
export const DIAGNOSTICS_TTL_MS = 5 * 60 * 1000;
