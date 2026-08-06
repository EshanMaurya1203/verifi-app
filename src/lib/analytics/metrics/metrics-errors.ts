// ─── VRF-ONBOARD-004D — Metrics Domain Errors ────────────────────────────────

export class MetricsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsError";
    Object.setPrototypeOf(this, MetricsError.prototype);
  }
}

export class MetricsValidationError extends MetricsError {
  constructor(message: string) {
    super(message);
    this.name = "MetricsValidationError";
    Object.setPrototypeOf(this, MetricsValidationError.prototype);
  }
}

export class MetricsIntegrityError extends MetricsError {
  constructor(message: string) {
    super(message);
    this.name = "MetricsIntegrityError";
    Object.setPrototypeOf(this, MetricsIntegrityError.prototype);
  }
}
