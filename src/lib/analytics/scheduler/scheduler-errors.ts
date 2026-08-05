// ─── VRF-ONBOARD-003C — Scheduler Errors Module ───────────────────────────

export class InvalidScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScheduleError";
  }
}

export class ScheduleEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleEvaluationError";
  }
}
