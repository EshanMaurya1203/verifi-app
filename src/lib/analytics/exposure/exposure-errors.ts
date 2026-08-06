// ─── VRF-ONBOARD-004B — Exposure Tracking Errors ─────────────────────────────

export class ExposureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExposureError";
  }
}

export class ExposureValidationError extends ExposureError {
  constructor(message: string) {
    super(message);
    this.name = "ExposureValidationError";
  }
}

export class ExposureIntegrityError extends ExposureError {
  constructor(message: string) {
    super(message);
    this.name = "ExposureIntegrityError";
  }
}
