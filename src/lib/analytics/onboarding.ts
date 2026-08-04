/**
 * VRF-ONBOARD-001D.1 — Onboarding Analytics Contract
 *
 * This file defines the event types, metadata schema, and helper types
 * for the onboarding analytics system.
 *
 * RULES:
 * - Analytics failures must NEVER break onboarding.
 * - Analytics is admin-only visibility.
 * - Analytics must be asynchronous (fire-and-forget).
 * - No third-party analytics tools.
 * - No sensitive data in metadata (API keys, secrets, emails, proof URLs).
 *
 * STATUS: Contract only — tracking functions are NOT implemented yet.
 */

// ─── Event Types ────────────────────────────────────────────────────

export type OnboardingEvent =
  | "onboarding_started"
  | "step_1_completed"
  | "step_2_completed"
  | "step_3_completed"
  | "submission_completed"
  | "submission_failed"
  | "draft_restored"
  | "draft_discarded";

// ─── Input Contract ─────────────────────────────────────────────────

export interface TrackOnboardingEventInput {
  event: OnboardingEvent;
  step?: number;
  metadata?: Record<string, unknown>;
}

// ─── Allowed Metadata Fields ────────────────────────────────────────

export const ALLOWED_METADATA_FIELDS = [
  "reason",
  "duration",
  "draft_age_hours",
  "provider",
] as const;

// ─── Failure Reason Types ───────────────────────────────────────────

export type SubmissionFailureReason =
  | "validation_error"
  | "duplicate_submission"
  | "slug_conflict"
  | "upload_failed"
  | "network_error";

// ─── Payment Provider Types ─────────────────────────────────────────

export type PaymentProvider =
  | "stripe"
  | "razorpay";

// ─── Forbidden Metadata Fields (documentation only) ─────────────────
//
// The following fields must NEVER appear in event metadata:
//   - api_key
//   - secret
//   - proof_url
//   - email
//   - password
//   - token
//
// Enforcement will be added in VRF-ONBOARD-001D.2.
