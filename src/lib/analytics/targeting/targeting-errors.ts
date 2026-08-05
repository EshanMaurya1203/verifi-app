// ─── VRF-ONBOARD-003B — Targeting Errors Module ───────────────────────────

export class InvalidTargetingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTargetingRuleError";
  }
}

export class EligibilityEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibilityEvaluationError";
  }
}
