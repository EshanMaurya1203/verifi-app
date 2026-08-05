// ─── VRF-ONBOARD-003D / 003D.1 — Governance Permissions Module ────────────

import type { ExperimentRole, GovernanceAction } from "./governance-types";

/**
 * Governance Permission Matrix.
 * Approval ≠ Activation.
 */
export const ROLE_PERMISSIONS: Record<ExperimentRole, readonly GovernanceAction[]> = {
  author: [
    "create",
    "edit",
    "request_review",
  ],

  reviewer: [
    "review",
  ],

  approver: [
    "approve",
  ],

  admin: [
    "create",
    "edit",
    "request_review",
    "review",
    "approve",
    "activate",
    "pause",
    "archive",
  ],
};

export function hasRolePermission(role: ExperimentRole, action: GovernanceAction): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return Array.isArray(permissions) && permissions.includes(action);
}
