// ─── VRF-ONBOARD-003E — Console Errors ────────────────────────────────────

export class ConsoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleError";
    Object.setPrototypeOf(this, ConsoleError.prototype);
  }
}

export class ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectionError";
    Object.setPrototypeOf(this, ProjectionError.prototype);
  }
}
