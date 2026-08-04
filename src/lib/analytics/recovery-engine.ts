import type { FounderJourney } from "./journey";
import type { FounderRecovery, RecoveryStatus } from "./recovery";

// ─── Recovery Engine ──────────────────────────────────────────────────
// Pure function that evaluates all founder journeys and identifies which
// at-risk sessions (failed / abandoned) were subsequently recovered by
// a completed session from the same founder.
//
// PAIRING RULES (E.10A — One-to-One Recovery Matching):
//   - Group journeys by userId, sort chronologically.
//   - Each completion session can recover AT MOST ONE preceding at-risk session.
//   - When a completion occurs, it recovers the MOST RECENT (latest) preceding
//     unrecovered at-risk session.
//   - Once a completion session is consumed, it cannot be reused.
//   - Recovery relationships are strictly one-to-one.
//
// Edge-case behavior:
//   A:failed (10:00) → B:failed (11:00) → C:completed (12:00)
//     => A:unrecovered, B:recovered(C)
//   A:failed → B:completed → C:abandoned → D:completed
//     => A→B, C→D
//   A:abandoned → B:abandoned → C:completed → D:completed
//     => A & B both recovered (1-to-1 with C & D)
//   A:failed → B:completed → C:completed
//     => A→B, C unused

/**
 * Builds recovery records for every at-risk (failed / abandoned) session.
 * Enforces strict one-to-one matching — each completion session can recover
 * at most one at-risk session.
 *
 * @param journeys - The full array of FounderJourney objects (all statuses).
 * @returns An array of FounderRecovery records, one per at-risk session.
 */
export function buildFounderRecoveries(
  journeys: readonly FounderJourney[]
): FounderRecovery[] {
  if (!journeys || journeys.length === 0) {
    return [];
  }

  // 1. Group journeys by userId
  const userJourneys = new Map<string, FounderJourney[]>();

  for (const journey of journeys) {
    const existing = userJourneys.get(journey.userId);
    if (existing) {
      existing.push(journey);
    } else {
      userJourneys.set(journey.userId, [journey]);
    }
  }

  const recoveries: FounderRecovery[] = [];

  // 2. For each user, sort chronologically and perform 1-to-1 recovery matching
  for (const [userId, userJourneyList] of userJourneys.entries()) {
    const sorted = [...userJourneyList].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    // Map of at-risk sessionId -> matching completion journey
    const pairedCompletions = new Map<string, FounderJourney>();
    const consumedCompletions = new Set<string>();

    // Find all completions in chronological order
    const completions = sorted.filter((j) => j.status === "completed");

    for (const completion of completions) {
      const completionTime = new Date(completion.startedAt).getTime();

      // Find the most recent unrecovered at-risk session preceding this completion
      let bestAtRisk: FounderJourney | null = null;
      let bestTime = -1;

      for (const journey of sorted) {
        if (journey.status === "failed" || journey.status === "abandoned") {
          const journeyTime = new Date(journey.startedAt).getTime();
          if (journeyTime < completionTime && !pairedCompletions.has(journey.sessionId)) {
            if (journeyTime > bestTime) {
              bestTime = journeyTime;
              bestAtRisk = journey;
            }
          }
        }
      }

      if (bestAtRisk) {
        pairedCompletions.set(bestAtRisk.sessionId, completion);
        consumedCompletions.add(completion.sessionId);
      }
    }

    // Build FounderRecovery records for all at-risk journeys
    for (const journey of sorted) {
      if (journey.status !== "failed" && journey.status !== "abandoned") {
        continue;
      }

      const originalStatus = journey.status as "failed" | "abandoned";
      const completion = pairedCompletions.get(journey.sessionId);

      if (completion) {
        const recoveredAt = completion.completedAt || completion.startedAt;
        const recoverySessionId = completion.sessionId;

        const originalEndTime = new Date(
          journey.completedAt || journey.startedAt
        ).getTime();
        const recoveryStartTime = new Date(completion.startedAt).getTime();
        const duration = recoveryStartTime - originalEndTime;
        const recoveryDurationMs = duration >= 0 && Number.isFinite(duration) ? duration : null;

        recoveries.push({
          sessionId: journey.sessionId,
          userId,
          originalStatus,
          recoveryStatus: "recovered",
          recoveredAt,
          recoveryDurationMs,
          recoverySessionId,
        });
      } else {
        recoveries.push({
          sessionId: journey.sessionId,
          userId,
          originalStatus,
          recoveryStatus: "not_recovered",
          recoveredAt: null,
          recoveryDurationMs: null,
          recoverySessionId: null,
        });
      }
    }
  }

  return recoveries;
}
