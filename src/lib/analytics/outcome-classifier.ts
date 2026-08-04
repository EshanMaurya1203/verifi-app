import type { OnboardingEvent } from "./onboarding";

export type OnboardingOutcome =
  | "completed"
  | "failed"
  | "abandoned"
  | "in_progress";

/**
 * Classifies an OnboardingEvent into a high-level domain outcome.
 *
 * MAPPING:
 * - "submission_completed" -> "completed"
 * - "submission_failed"    -> "failed"
 * - "draft_discarded"      -> "abandoned"
 * - "onboarding_started"   -> "in_progress"
 * - "step_1_completed"     -> "in_progress"
 * - "step_2_completed"     -> "in_progress"
 * - "step_3_completed"     -> "in_progress"
 * - "draft_restored"       -> "in_progress"
 */
export function classifyOutcome(event: OnboardingEvent | string): OnboardingOutcome {
  switch (event) {
    case "submission_completed":
      return "completed";
    case "submission_failed":
      return "failed";
    case "draft_discarded":
      return "abandoned";
    case "onboarding_started":
    case "step_1_completed":
    case "step_2_completed":
    case "step_3_completed":
    case "draft_restored":
    default:
      return "in_progress";
  }
}
