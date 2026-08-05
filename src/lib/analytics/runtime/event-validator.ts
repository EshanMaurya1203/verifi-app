// ─── VRF-ONBOARD-002A / 002X — Runtime Event Validator ──────────────────────

import type { OnboardingEventType, RuntimeEvent } from "./runtime-types";

export interface EventValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_EVENT_TYPES: Set<string> = new Set<OnboardingEventType>([
  "landing_page_viewed",
  "signup_started",
  "signup_completed",
  "onboarding_started",
  "onboarding_step_completed",
  "onboarding_abandoned",
  "onboarding_completed",
  "stripe_connected",
  "stripe_sync_success",
  "stripe_sync_failed",
  "razorpay_connected",
  "razorpay_sync_success",
  "razorpay_sync_failed",
  "proof_uploaded",
  "verification_submitted",
  "verification_approved",
  "verification_rejected",
  "experiment_assigned",
  "variant_exposed",
  "variant_rendered",
  "variant_seen",
  "variant_completed",
]);

/**
 * Validates a RuntimeEvent payload against structural and business logic rules.
 *
 * Rules:
 * - id is required (non-empty string)
 * - sessionId is required (non-empty string)
 * - eventType is required (must belong to OnboardingEventType)
 * - createdAt is required (valid Date object)
 * - experiment_assigned, variant_exposed, variant_rendered, variant_seen, variant_completed require experimentId and variantId
 */
export function validateEvent(event: RuntimeEvent): EventValidationResult {
  const errors: string[] = [];

  if (!event) {
    return { valid: false, errors: ["Event payload is required."] };
  }

  if (!event.id || typeof event.id !== "string" || event.id.trim() === "") {
    errors.push("Runtime event must have a non-empty id.");
  }

  if (!event.sessionId || typeof event.sessionId !== "string" || event.sessionId.trim() === "") {
    errors.push("Runtime event must contain a non-empty sessionId.");
  }

  if (!event.eventType || !VALID_EVENT_TYPES.has(event.eventType)) {
    errors.push(`Invalid eventType '${event.eventType}'. Must belong to OnboardingEventType enum.`);
  }

  if (!event.createdAt || !(event.createdAt instanceof Date) || isNaN(event.createdAt.getTime())) {
    errors.push("Runtime event must have a valid createdAt timestamp.");
  }

  // Experiment-specific consistency checks
  const experimentEventTypes = new Set<OnboardingEventType>([
    "experiment_assigned",
    "variant_exposed",
    "variant_rendered",
    "variant_seen",
    "variant_completed",
  ]);

  if (experimentEventTypes.has(event.eventType)) {
    if (!event.experimentId || typeof event.experimentId !== "string" || event.experimentId.trim() === "") {
      errors.push(`Event '${event.eventType}' requires a valid experimentId.`);
    }
    if (!event.variantId || typeof event.variantId !== "string" || event.variantId.trim() === "") {
      errors.push(`Event '${event.eventType}' requires a valid variantId.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
