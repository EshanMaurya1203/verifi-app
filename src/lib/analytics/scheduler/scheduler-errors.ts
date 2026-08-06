// ─── VRF-ONBOARD-005D — Experiment Scheduler Errors ──────────────────────────

export class SchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerError";
    Object.setPrototypeOf(this, SchedulerError.prototype);
  }
}

export class ScheduleEvaluationError extends SchedulerError {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleEvaluationError";
    Object.setPrototypeOf(this, ScheduleEvaluationError.prototype);
  }
}

export class SchedulerValidationError extends SchedulerError {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerValidationError";
    Object.setPrototypeOf(this, SchedulerValidationError.prototype);
  }
}

export class SchedulerIntegrityError extends SchedulerError {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerIntegrityError";
    Object.setPrototypeOf(this, SchedulerIntegrityError.prototype);
  }
}
