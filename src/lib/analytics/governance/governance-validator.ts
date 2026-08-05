// ─── VRF-ONBOARD-003D / 003D.2 — Governance Validator Module ──────────────

import type { GovernanceActor } from "./governance-types";
import type { GovernanceAuditEntry } from "./governance-audit";
import { ROLE_PERMISSIONS } from "./governance-permissions";

export interface GovernanceValidationResult {
  passed: boolean;

  errors: string[];
}

const VALID_ROLES = ["author", "reviewer", "approver", "admin"] as const;

/**
 * Validates mandatory experiment ownerId metadata.
 */
export function validateOwnership(ownerId?: unknown): GovernanceValidationResult {
  const errors: string[] = [];

  if (ownerId === undefined || ownerId === null) {
    errors.push("ownerId is required and cannot be undefined or null.");
  } else if (typeof ownerId !== "string" || ownerId.trim() === "") {
    errors.push("ownerId must be a non-empty string.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates a GovernanceActor for structural and field integrity.
 */
export function validateGovernanceActor(
  actor: GovernanceActor
): GovernanceValidationResult {
  const errors: string[] = [];

  if (!actor) {
    errors.push("GovernanceActor definition is missing.");
    return { passed: false, errors };
  }

  if (!actor.id || typeof actor.id !== "string" || actor.id.trim() === "") {
    errors.push("Actor id is required and cannot be empty.");
  }

  if (!actor.role || !VALID_ROLES.includes(actor.role)) {
    errors.push(`Invalid actor role '${actor.role}'. Allowed roles: ${VALID_ROLES.join(", ")}.`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates that the permissions matrix is defined and complete for all system roles.
 */
export function validatePermissions(): GovernanceValidationResult {
  const errors: string[] = [];

  for (const role of VALID_ROLES) {
    const perms = ROLE_PERMISSIONS[role];
    if (!Array.isArray(perms) || perms.length === 0) {
      errors.push(`Role '${role}' has empty or missing permission declarations.`);
    }
  }

  // Verify review / request_review separation
  if (!ROLE_PERMISSIONS.author.includes("request_review")) {
    errors.push("Author role missing 'request_review' permission.");
  }
  if (!ROLE_PERMISSIONS.reviewer.includes("review")) {
    errors.push("Reviewer role missing 'review' permission.");
  }
  if (ROLE_PERMISSIONS.reviewer.includes("approve")) {
    errors.push("Reviewer role must not possess 'approve' permission.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates an audit entry for required fields, sequence, and timestamp presence.
 */
export function validateAuditEntry(
  entry: Partial<GovernanceAuditEntry>
): GovernanceValidationResult {
  const errors: string[] = [];

  if (!entry) {
    errors.push("Audit entry is missing.");
    return { passed: false, errors };
  }

  if (entry.sequence === undefined || entry.sequence === null || typeof entry.sequence !== "number" || !Number.isInteger(entry.sequence) || entry.sequence < 0) {
    errors.push("Audit entry sequence is required, must be an integer, and must be >= 0.");
  }

  if (!entry.actorId || typeof entry.actorId !== "string" || entry.actorId.trim() === "") {
    errors.push("Audit entry actorId is required.");
  }

  if (!entry.action) {
    errors.push("Audit entry action is required.");
  }

  if (!entry.experimentId || typeof entry.experimentId !== "string" || entry.experimentId.trim() === "") {
    errors.push("Audit entry experimentId is required.");
  }

  if (!entry.timestamp || !(entry.timestamp instanceof Date) || isNaN(entry.timestamp.getTime())) {
    errors.push("Audit entry timestamp is required and must be a valid Date object.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
