// ─── VRF-ONBOARD-003A — Registry Error Classes ───────────────────────────

export class DuplicateExperimentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateExperimentError";
  }
}

export class InvalidExperimentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExperimentError";
  }
}

export class VersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionConflictError";
  }
}

export class LifecycleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleViolationError";
  }
}
