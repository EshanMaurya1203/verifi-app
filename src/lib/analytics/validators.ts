/**
 * VRF-ONBOARD-001D.2 — Onboarding Analytics Validators & Sanitizers
 *
 * Pure utility module for validating analytics event schema, step boundaries,
 * failure reasons, payment providers, and sanitizing event metadata.
 *
 * RULES & CONSTRAINTS:
 * - Pure utility file — zero side effects, zero external state.
 * - No DB, API, tracker, or React dependencies.
 * - Enforces strict whitelist of allowed metadata fields.
 * - Enforces strict blacklist defense stripping any sensitive pattern keys.
 */

// ─── Exported Types ───────────────────────────────────────────────────

export type OnboardingEvent =
  | "onboarding_started"
  | "step_1_completed"
  | "step_2_completed"
  | "step_3_completed"
  | "submission_completed"
  | "submission_failed"
  | "draft_restored"
  | "draft_discarded";

export type SubmissionFailureReason =
  | "validation_error"
  | "duplicate_submission"
  | "slug_conflict"
  | "upload_failed"
  | "network_error";

export type Provider = "stripe" | "razorpay";

export type SanitizedMetadata = {
  reason?: SubmissionFailureReason;
  duration?: number;
  draft_age_hours?: number;
  provider?: Provider;
};

// ─── Exported Constants ───────────────────────────────────────────────

export const ALLOWED_EVENTS = [
  "onboarding_started",
  "step_1_completed",
  "step_2_completed",
  "step_3_completed",
  "submission_completed",
  "submission_failed",
  "draft_restored",
  "draft_discarded",
] as const;

export const ALLOWED_METADATA_FIELDS = [
  "reason",
  "duration",
  "draft_age_hours",
  "provider",
] as const;

export const FORBIDDEN_METADATA_PATTERNS = [
  "api_key",
  "secret",
  "proof_url",
  "email",
  "password",
  "token",
  "key",
  "url",
] as const;

// ─── Strongly-Typed Internal Lookup Sets ─────────────────────────────

const ALLOWED_EVENTS_SET = new Set<OnboardingEvent>(ALLOWED_EVENTS);

const ALLOWED_FAILURE_REASONS_SET = new Set<SubmissionFailureReason>([
  "validation_error",
  "duplicate_submission",
  "slug_conflict",
  "upload_failed",
  "network_error",
]);

const ALLOWED_PROVIDERS_SET = new Set<Provider>(["stripe", "razorpay"]);

const ALLOWED_METADATA_FIELDS_SET = new Set<string>(ALLOWED_METADATA_FIELDS);

// ─── Type Guards ──────────────────────────────────────────────────────

export function isOnboardingEvent(
  value: unknown
): value is OnboardingEvent {
  return (
    typeof value === "string" &&
    ALLOWED_EVENTS_SET.has(value as OnboardingEvent)
  );
}

export function isProvider(
  value: unknown
): value is Provider {
  return (
    typeof value === "string" &&
    ALLOWED_PROVIDERS_SET.has(value as Provider)
  );
}

export function isSubmissionFailureReason(
  value: unknown
): value is SubmissionFailureReason {
  return (
    typeof value === "string" &&
    ALLOWED_FAILURE_REASONS_SET.has(
      value as SubmissionFailureReason
    )
  );
}

// ─── Validation Functions ─────────────────────────────────────────────

/**
 * Validates an event string against the frozen OnboardingEvent schema.
 * Returns the typed event string if valid, otherwise null.
 */
export function validateEvent(event: unknown): OnboardingEvent | null {
  return isOnboardingEvent(event) ? event : null;
}

/**
 * Validates step number boundaries.
 * Returns integer 1–4 if valid, otherwise undefined.
 */
export function validateStep(step: unknown): number | undefined {
  if (
    typeof step === "number" &&
    Number.isInteger(step) &&
    step >= 1 &&
    step <= 4
  ) {
    return step;
  }
  return undefined;
}

/**
 * Validates payment provider string.
 * Returns "stripe" | "razorpay" if valid, otherwise null.
 */
export function validateProvider(provider: unknown): Provider | null {
  return isProvider(provider) ? provider : null;
}

/**
 * Validates submission failure reason string.
 * Returns typed SubmissionFailureReason if valid, otherwise null.
 */
export function validateFailureReason(
  reason: unknown
): SubmissionFailureReason | null {
  return isSubmissionFailureReason(reason) ? reason : null;
}

/**
 * Sanitizes arbitrary metadata object against whitelist and blacklist rules.
 *
 * Rules:
 * 1. Must be a non-null object literal.
 * 2. Any key containing forbidden pattern substrings (api_key, secret, proof_url,
 *    email, password, token, key, url) is stripped.
 * 3. Only whitelisted keys ("reason", "duration", "draft_age_hours", "provider") are retained.
 * 4. Value-level validation:
 *    - "reason": must be valid SubmissionFailureReason.
 *    - "duration": positive finite number, rounded to nearest integer.
 *    - "draft_age_hours": non-negative finite number, rounded to 1 decimal place.
 *    - "provider": must be "stripe" or "razorpay".
 */
export function sanitizeMetadata(
  metadata: unknown
): SanitizedMetadata {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return {};
  }

  const result: SanitizedMetadata = {};

  for (const [rawKey, val] of Object.entries(metadata)) {
    const key = rawKey.toLowerCase().trim();

    // 1. Blacklist check: strip key if it contains any forbidden pattern substring
    const isForbidden = FORBIDDEN_METADATA_PATTERNS.some((pattern) =>
      key.includes(pattern)
    );
    if (isForbidden) {
      continue;
    }

    // 2. Whitelist check: retain only explicitly allowed metadata fields using normalized key
    if (!ALLOWED_METADATA_FIELDS_SET.has(key)) {
      continue;
    }

    // 3. Field-level validation and coercion using normalized key
    if (key === "reason") {
      const validReason = validateFailureReason(val);
      if (validReason) {
        result.reason = validReason;
      }
    } else if (key === "provider") {
      const validProvider = validateProvider(val);
      if (validProvider) {
        result.provider = validProvider;
      }
    } else if (key === "duration") {
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        result.duration = Math.round(val);
      }
    } else if (key === "draft_age_hours") {
      if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
        result.draft_age_hours = Math.round(val * 10) / 10;
      }
    }
  }

  return result;
}
