// ─── VRF-ONBOARD-003D / 003D.1 — Governance Engine Module ─────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceActor, GovernanceAction, GovernanceDecision } from "./governance-types";
import { hasRolePermission } from "./governance-permissions";
import { isOwner } from "./governance-utils";

const VALID_ROLES = ["author", "reviewer", "approver", "admin"] as const;

/**
 * Governance Workflow:
 *
 * draft → request_review → review → approve → activate → pause/archive
 *
 * Governance authorizes transitions.
 * Governance NEVER executes transitions.
 *
 * Evaluation Strategy:
 * - Full evaluation
 * - No fail-fast behavior
 * - Collect all failures
 * - Deterministic check order
 *
 * Complexity:
 * O(number_of_checks)
 *
 * Current checks:
 * 1. actor
 * 2. role
 * 3. permission
 * 4. ownership
 * 5. lifecycle
 */
export function canPerformAction(
  actor: GovernanceActor,
  action: GovernanceAction,
  experiment?: ExperimentDefinition
): GovernanceDecision {
  const matchedChecks: string[] = [];
  const failedChecks: string[] = [];
  const failureReasons: string[] = [];

  // 1. Actor Check
  if (actor && typeof actor.id === "string" && actor.id.trim() !== "") {
    matchedChecks.push("actor");
  } else {
    failedChecks.push("actor");
    failureReasons.push("Invalid or missing actor");
  }

  // 2. Role Check
  if (actor && actor.role && (VALID_ROLES as readonly string[]).includes(actor.role)) {
    matchedChecks.push("role");
  } else {
    failedChecks.push("role");
    failureReasons.push("Invalid or unrecognized actor role");
  }

  // 3. Permission Check
  if (actor && actor.role && hasRolePermission(actor.role, action)) {
    matchedChecks.push("permission");
  } else {
    failedChecks.push("permission");
    failureReasons.push(`Actor role '${actor?.role}' lacks permission for action '${action}'`);
  }

  // 4. Ownership Check
  if (actor && experiment) {
    if (action === "create" || action === "review" || action === "approve" || actor.role === "admin") {
      matchedChecks.push("ownership");
    } else if (isOwner(actor, experiment)) {
      matchedChecks.push("ownership");
    } else {
      failedChecks.push("ownership");
      failureReasons.push("Actor is not the owner of the experiment");
    }
  } else {
    matchedChecks.push("ownership");
  }

  // 5. Lifecycle Compatibility Check
  if (experiment) {
    if (experiment.status === "archived") {
      failedChecks.push("lifecycle");
      failureReasons.push("Archived experiments cannot undergo governance actions");
    } else {
      let lifecycleAllowed = true;

      switch (action) {
        case "request_review":
          lifecycleAllowed = experiment.status === "draft";
          break;
        case "review":
          lifecycleAllowed = experiment.status === "draft" || experiment.status === "review";
          break;
        case "approve":
          lifecycleAllowed = experiment.status === "review";
          break;
        case "activate":
          lifecycleAllowed = experiment.status === "approved" || experiment.status === "paused";
          break;
        case "pause":
          lifecycleAllowed = experiment.status === "active";
          break;
        case "archive":
          lifecycleAllowed = experiment.status === "active" || experiment.status === "paused";
          break;
        case "edit":
          lifecycleAllowed = true;
          break;
        case "create":
          lifecycleAllowed = true;
          break;
      }

      if (lifecycleAllowed) {
        matchedChecks.push("lifecycle");
      } else {
        failedChecks.push("lifecycle");
        failureReasons.push(`Action '${action}' is invalid for experiment status '${experiment.status}'`);
      }
    }
  } else {
    matchedChecks.push("lifecycle");
  }

  const allowed = failedChecks.length === 0;
  const reason = allowed ? undefined : failureReasons.join("; ");

  return {
    allowed,
    reason,
    matchedChecks,
    failedChecks,
  };
}
