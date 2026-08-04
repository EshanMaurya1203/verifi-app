import type { RawOnboardingEventRecord } from "./events";
import type { FounderJourney, JourneyStep } from "./journey";
import { buildJourneySessions } from "./journey-session";
import { determineJourneyStatus } from "./journey-status";
import { extractProvider } from "./provider-extractor";

/**
 * Pure builder function transforming raw onboarding event records into structured FounderJourney objects.
 * Uses buildJourneySessions for session isolation and determineJourneyStatus for status resolution.
 */
export function buildFounderJourneys(
  events: readonly RawOnboardingEventRecord[]
): FounderJourney[] {
  if (!events || events.length === 0) {
    return [];
  }

  const sessionsMap = buildJourneySessions(events);
  const journeys: FounderJourney[] = [];

  for (const [sessionId, sessionEvents] of sessionsMap.entries()) {
    if (sessionEvents.length === 0) continue;

    // Sort chronologically by timestamp
    const sortedEvents = [...sessionEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const firstRecord = sortedEvents[0];
    const userId = firstRecord.user_id || "anonymous";
    const startedAt = firstRecord.created_at;

    const completionRecord = sortedEvents.find((e) => e.event_name === "submission_completed");
    const completedAt = completionRecord ? completionRecord.created_at : null;

    let durationMs: number | null = null;
    if (completedAt && startedAt) {
      const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
      if (diff >= 0 && Number.isFinite(diff)) {
        durationMs = diff;
      }
    }

    const status = determineJourneyStatus(sortedEvents);

    const steps: readonly JourneyStep[] = sortedEvents.map((r) => ({
      event: r.event_name,
      timestamp: r.created_at,
      provider: extractProvider(r),
    }));

    journeys.push({
      sessionId,
      userId,
      startedAt,
      completedAt,
      status,
      durationMs,
      steps,
    });
  }

  return journeys;
}
