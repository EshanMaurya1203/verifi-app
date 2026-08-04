// ─── Recovery Domain Model ────────────────────────────────────────────
// Defines the data structures for tracking founder recovery after
// failed or abandoned onboarding attempts.

export type RecoveryStatus = "recovered" | "not_recovered";

export interface FounderRecovery {
  /** Session ID of the original failed/abandoned journey */
  readonly sessionId: string;

  /** Founder user ID */
  readonly userId: string;

  /** The status of the original at-risk journey */
  readonly originalStatus: "failed" | "abandoned";

  /** Whether the founder later completed onboarding */
  readonly recoveryStatus: RecoveryStatus;

  /** ISO timestamp when the recovery completion occurred, or null */
  readonly recoveredAt: string | null;

  /** Duration in ms between failure/abandonment and successful restart, or null */
  readonly recoveryDurationMs: number | null;

  /** Session ID of the recovery (completed) journey, or null */
  readonly recoverySessionId: string | null;
}

/**
 * Represents a strict one-to-one pairing between an at-risk session and
 * a recovery session. A completion session may recover exactly one
 * at-risk session, and an at-risk session may be recovered by exactly
 * one completion session.
 */
export interface RecoveryMatch {
  /** Session ID of the original failed/abandoned journey */
  readonly sourceSessionId: string;

  /** Session ID of the completion journey that recovered it */
  readonly recoverySessionId: string;
}
