import type { RawOnboardingEventRecord } from "./events";
import type { JourneyStatus } from "./journey";

/**
 * Evaluates the full event stream of a journey session to resolve its canonical status.
 *
 * PRIORITY RULES:
 * 1. "completed"   — Session contains "submission_completed"
 * 2. "failed"      — Session contains "submission_failed" (and no completion)
 * 3. "abandoned"   — Session contains "draft_discarded" (and no completion/failure)
 * 4. "in_progress" — Default for active sessions
 */
export function determineJourneyStatus(
  sessionEvents: readonly RawOnboardingEventRecord[]
): JourneyStatus {
  if (!sessionEvents || sessionEvents.length === 0) {
    return "in_progress";
  }

  let hasCompleted = false;
  let hasFailed = false;
  let hasDiscarded = false;

  for (const record of sessionEvents) {
    if (record.event_name === "submission_completed") {
      hasCompleted = true;
    } else if (record.event_name === "submission_failed") {
      hasFailed = true;
    } else if (record.event_name === "draft_discarded") {
      hasDiscarded = true;
    }
  }

  if (hasCompleted) {
    return "completed";
  }
  if (hasFailed) {
    return "failed";
  }
  if (hasDiscarded) {
    return "abandoned";
  }

  return "in_progress";
}
