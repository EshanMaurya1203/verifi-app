import type { FounderRecovery } from "./recovery";

// ─── Recovery Cohort Breakdown ────────────────────────────────────────

export interface RecoveryCohortBreakdown {
  /** Founders who failed and then completed */
  readonly recoveredAfterFailure: number;
  /** Founders who abandoned and then completed */
  readonly recoveredAfterAbandonment: number;
  /** Founders who failed and never completed */
  readonly unrecoveredAfterFailure: number;
  /** Founders who abandoned and never completed */
  readonly unrecoveredAfterAbandonment: number;
}

// ─── Recovery Report ──────────────────────────────────────────────────

export interface RecoveryReport {
  /** Percentage of at-risk sessions that were later recovered (0–100) */
  readonly recoveryRate: number;
  /** Average time to recovery in ms (across recovered sessions only) */
  readonly averageRecoveryTimeMs: number;
  /** Total number of recovered sessions */
  readonly recoveredFounders: number;
  /** Total number of unrecovered sessions */
  readonly unrecoveredFounders: number;
  /** Shortest recovery time in ms, or null if no recoveries */
  readonly fastestRecoveryMs: number | null;
  /** Longest recovery time in ms, or null if no recoveries */
  readonly slowestRecoveryMs: number | null;
  /** Cohort breakdown by original status and recovery outcome */
  readonly cohorts: RecoveryCohortBreakdown;
}

// ─── Filter Helpers ───────────────────────────────────────────────────

/**
 * Returns only recovered entries.
 */
export function findRecoveredJourneys(
  recoveries: readonly FounderRecovery[]
): readonly FounderRecovery[] {
  return recoveries.filter((r) => r.recoveryStatus === "recovered");
}

/**
 * Returns only unrecovered entries.
 */
export function findUnrecoveredJourneys(
  recoveries: readonly FounderRecovery[]
): readonly FounderRecovery[] {
  return recoveries.filter((r) => r.recoveryStatus === "not_recovered");
}

// ─── Report Builder ───────────────────────────────────────────────────

/**
 * Builds a full recovery report from an array of FounderRecovery records.
 */
export function buildRecoveryReport(
  recoveries: readonly FounderRecovery[]
): RecoveryReport {
  if (!recoveries || recoveries.length === 0) {
    return {
      recoveryRate: 0,
      averageRecoveryTimeMs: 0,
      recoveredFounders: 0,
      unrecoveredFounders: 0,
      fastestRecoveryMs: null,
      slowestRecoveryMs: null,
      cohorts: {
        recoveredAfterFailure: 0,
        recoveredAfterAbandonment: 0,
        unrecoveredAfterFailure: 0,
        unrecoveredAfterAbandonment: 0,
      },
    };
  }

  const recovered = findRecoveredJourneys(recoveries);
  const unrecovered = findUnrecoveredJourneys(recoveries);

  // Recovery rate
  const total = recoveries.length;
  const recoveryRate = total > 0
    ? Math.round((recovered.length / total) * 1000) / 10
    : 0;

  // Recovery time statistics (only from recovered entries with valid durations)
  const validDurations = recovered
    .map((r) => r.recoveryDurationMs)
    .filter((d): d is number => d !== null && d >= 0 && Number.isFinite(d));

  let averageRecoveryTimeMs = 0;
  let fastestRecoveryMs: number | null = null;
  let slowestRecoveryMs: number | null = null;

  if (validDurations.length > 0) {
    const sum = validDurations.reduce((acc, d) => acc + d, 0);
    averageRecoveryTimeMs = Math.round(sum / validDurations.length);
    fastestRecoveryMs = Math.min(...validDurations);
    slowestRecoveryMs = Math.max(...validDurations);
  }

  // Cohort breakdown
  const cohorts: RecoveryCohortBreakdown = {
    recoveredAfterFailure: recovered.filter((r) => r.originalStatus === "failed").length,
    recoveredAfterAbandonment: recovered.filter((r) => r.originalStatus === "abandoned").length,
    unrecoveredAfterFailure: unrecovered.filter((r) => r.originalStatus === "failed").length,
    unrecoveredAfterAbandonment: unrecovered.filter((r) => r.originalStatus === "abandoned").length,
  };

  return {
    recoveryRate,
    averageRecoveryTimeMs,
    recoveredFounders: recovered.length,
    unrecoveredFounders: unrecovered.length,
    fastestRecoveryMs,
    slowestRecoveryMs,
    cohorts,
  };
}
