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
// ─── VRF-ONBOARD-004E — Statistics Domain Errors ─────────────────────────────

export class StatisticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatisticsError";
    Object.setPrototypeOf(this, StatisticsError.prototype);
  }
}

export class StatisticsValidationError extends StatisticsError {
  constructor(message: string) {
    super(message);
    this.name = "StatisticsValidationError";
    Object.setPrototypeOf(this, StatisticsValidationError.prototype);
  }
}

export class StatisticsIntegrityError extends StatisticsError {
  constructor(message: string) {
    super(message);
    this.name = "StatisticsIntegrityError";
    Object.setPrototypeOf(this, StatisticsIntegrityError.prototype);
  }
}
