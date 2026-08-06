// ─── VRF-ONBOARD-004C — Conversion Engine Errors ─────────────────────────────

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export class ConversionValidationError extends ConversionError {
  constructor(message: string) {
    super(message);
    this.name = "ConversionValidationError";
  }
}

export class ConversionIntegrityError extends ConversionError {
  constructor(message: string) {
    super(message);
    this.name = "ConversionIntegrityError";
  }
}
