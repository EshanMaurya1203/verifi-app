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
// ─── VRF-ONBOARD-005B — Rollout Engine Errors ────────────────────────────────

export class RolloutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RolloutError";
    Object.setPrototypeOf(this, RolloutError.prototype);
  }
}

export class RolloutValidationError extends RolloutError {
  constructor(message: string) {
    super(message);
    this.name = "RolloutValidationError";
    Object.setPrototypeOf(this, RolloutValidationError.prototype);
  }
}

export class RolloutIntegrityError extends RolloutError {
  constructor(message: string) {
    super(message);
    this.name = "RolloutIntegrityError";
    Object.setPrototypeOf(this, RolloutIntegrityError.prototype);
  }
}
