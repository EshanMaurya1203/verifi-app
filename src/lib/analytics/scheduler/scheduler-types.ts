// ─── VRF-ONBOARD-003C / 003C.1 — Scheduler Types Module ───────────────────

export interface ExperimentSchedule {
  enabled: boolean;

  startsAt?: Date;

  endsAt?: Date;

  /**
   * timezone is informational metadata only.
   * timezone does not affect scheduling.
   * timezone validation deferred.
   */
  timezone?: string;
}

export interface ScheduleResult {
  active: boolean;

  reason?: string;

  matchedChecks: string[];

  failedChecks: string[];
}
