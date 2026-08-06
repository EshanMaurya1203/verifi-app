/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-005C — Deployment Executor Errors ───────────────────────────

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }
}

export class ExecutionValidationError extends ExecutionError {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionValidationError";
    Object.setPrototypeOf(this, ExecutionValidationError.prototype);
  }
}

export class ExecutionIntegrityError extends ExecutionError {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionIntegrityError";
    Object.setPrototypeOf(this, ExecutionIntegrityError.prototype);
  }
}
