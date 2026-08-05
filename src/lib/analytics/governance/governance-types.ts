// ─── VRF-ONBOARD-003D / 003D.1 — Governance Types Module ───────────────────

export type ExperimentRole =
  | "author"
  | "reviewer"
  | "approver"
  | "admin";

export interface GovernanceActor {
  id: string;

  role: ExperimentRole;
}

export type GovernanceAction =
  | "create"
  | "edit"
  | "request_review"
  | "review"
  | "approve"
  | "activate"
  | "pause"
  | "archive";

export interface GovernanceDecision {
  allowed: boolean;

  reason?: string;

  matchedChecks: string[];

  failedChecks: string[];
}
