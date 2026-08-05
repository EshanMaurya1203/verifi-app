// ─── VRF-ONBOARD-004A — Runtime Errors ──────────────────────────────────────

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

export class RuntimeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeValidationError";
  }
}

export class RuntimeAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeAssignmentError";
  }
}
