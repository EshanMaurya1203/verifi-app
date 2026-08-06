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
// ─── VRF-ONBOARD-005A — Decision Engine Errors ───────────────────────────────

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
    Object.setPrototypeOf(this, DecisionError.prototype);
  }
}

export class DecisionValidationError extends DecisionError {
  constructor(message: string) {
    super(message);
    this.name = "DecisionValidationError";
    Object.setPrototypeOf(this, DecisionValidationError.prototype);
  }
}

export class DecisionIntegrityError extends DecisionError {
  constructor(message: string) {
    super(message);
    this.name = "DecisionIntegrityError";
    Object.setPrototypeOf(this, DecisionIntegrityError.prototype);
  }
}
