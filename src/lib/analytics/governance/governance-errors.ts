// ─── VRF-ONBOARD-003D — Governance Errors Module ──────────────────────────

export class GovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernanceError";
  }
}

export class PermissionDeniedError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class InvalidActorError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidActorError";
  }
}
