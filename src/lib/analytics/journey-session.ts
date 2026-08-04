import type { RawOnboardingEventRecord } from "./events";
import { INACTIVITY_THRESHOLD_MS, RESTART_WINDOW_MS } from "./diagnostics-config";

export interface JourneySession {
  readonly sessionId: string;
  readonly userId: string;
}

/**
 * Groups raw onboarding event records into discrete journey sessions.
 *
 * POLICY (VRF-ONBOARD-001E.9B):
 * - Rule A (Session ID): If event metadata contains an explicit session_id, group strictly by session_id.
 * - Rule B (Inactivity Gap): If gap between consecutive user events > INACTIVITY_THRESHOLD_MS (24h), start a new session.
 * - Rule C (Rapid Refresh/Retry): If event is "onboarding_started" and gap < RESTART_WINDOW_MS (10m),
 *   append to current session (prevents artificial journey count inflation from double-clicks/page refreshes).
 * - Rule D (Deliberate Restart): If event is "onboarding_started" and gap >= RESTART_WINDOW_MS (10m), start a new session.
 *
 * Returns a Map of sessionId -> array of RawOnboardingEventRecord sorted chronologically.
 */
export function buildJourneySessions(
  events: readonly RawOnboardingEventRecord[]
): Map<string, RawOnboardingEventRecord[]> {
  const sessionsMap = new Map<string, RawOnboardingEventRecord[]>();
  const activeUserSessionMap = new Map<string, { sessionId: string; lastTimestamp: number }>();

  let syntheticCounter = 0;

  for (const record of events) {
    const userId = record.user_id || `anonymous_${record.created_at}`;
    const recordTime = new Date(record.created_at).getTime();
    const explicitSessionId = typeof record.metadata?.session_id === "string" ? record.metadata.session_id : null;

    // Rule A: Explicit session_id takes highest priority
    if (explicitSessionId) {
      const existing = sessionsMap.get(explicitSessionId) || [];
      sessionsMap.set(explicitSessionId, [...existing, record]);
      activeUserSessionMap.set(userId, { sessionId: explicitSessionId, lastTimestamp: recordTime });
      continue;
    }

    const activeState = activeUserSessionMap.get(userId);

    // Initial session for user
    if (!activeState) {
      syntheticCounter++;
      const newSessionId = `session_${userId}_${syntheticCounter}`;
      sessionsMap.set(newSessionId, [record]);
      activeUserSessionMap.set(userId, { sessionId: newSessionId, lastTimestamp: recordTime });
      continue;
    }

    const timeSinceLast = recordTime - activeState.lastTimestamp;

    // Rule B: Inactivity gap (> 24h)
    if (timeSinceLast > INACTIVITY_THRESHOLD_MS) {
      syntheticCounter++;
      const newSessionId = `session_${userId}_${syntheticCounter}`;
      sessionsMap.set(newSessionId, [record]);
      activeUserSessionMap.set(userId, { sessionId: newSessionId, lastTimestamp: recordTime });
      continue;
    }

    // Rule C & D: onboarding_started restart logic
    if (record.event_name === "onboarding_started") {
      if (timeSinceLast >= RESTART_WINDOW_MS) {
        // Rule D: Deliberate restart >= 10m -> New session
        syntheticCounter++;
        const newSessionId = `session_${userId}_${syntheticCounter}`;
        sessionsMap.set(newSessionId, [record]);
        activeUserSessionMap.set(userId, { sessionId: newSessionId, lastTimestamp: recordTime });
        continue;
      }
      // Rule C: Rapid refresh/retry < 10m -> Append to current session
    }

    // Append to current session
    const currentRecords = sessionsMap.get(activeState.sessionId) || [];
    sessionsMap.set(activeState.sessionId, [...currentRecords, record]);
    activeUserSessionMap.set(userId, { sessionId: activeState.sessionId, lastTimestamp: recordTime });
  }

  return sessionsMap;
}
