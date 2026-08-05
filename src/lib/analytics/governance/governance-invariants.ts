// ─── VRF-ONBOARD-003D — Governance Invariants Module ──────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceActor, GovernanceAction, GovernanceDecision } from "./governance-types";
import type { GovernanceAuditLog } from "./governance-audit";
import { canPerformAction } from "./governance-engine";

export interface GovernanceInvariantCheckContext {
  actor?: GovernanceActor;

  action?: GovernanceAction;

  experimentDefinition?: ExperimentDefinition;

  decision?: GovernanceDecision;

  auditLog?: GovernanceAuditLog;
}

export interface GovernanceInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "warning" | "high" | "critical";

  reason?: string;
}

export interface GovernanceInvariant {
  id: string;

  name: string;

  description: string;

  severity: "warning" | "high" | "critical";

  check: (context: GovernanceInvariantCheckContext) => GovernanceInvariantResult;
}

/**
 * Invariant #89: Permission Deterministic. Same input → same output.
 */
export const INV_089_PERMISSION_DETERMINISTIC: GovernanceInvariant = {
  id: "INV_089_PERMISSION_DETERMINISTIC",
  name: "Governance Permission Determinism Guard",
  description: "Executing governance evaluation on identical inputs must yield identical decision and check diagnostics.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.actor || !ctx.action) {
      return {
        passed: true,
        invariantId: "INV_089_PERMISSION_DETERMINISTIC",
        name: "Governance Permission Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);
    const res2 = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);

    const passed =
      res1.allowed === res2.allowed &&
      res1.matchedChecks.join(",") === res2.matchedChecks.join(",") &&
      res1.failedChecks.join(",") === res2.failedChecks.join(",");

    return {
      passed,
      invariantId: "INV_089_PERMISSION_DETERMINISTIC",
      name: "Governance Permission Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Governance decision produced non-deterministic outputs across evaluation runs.",
    };
  },
};

/**
 * Invariant #90: Ownership Enforced. Non-admin author cannot modify non-owned experiment.
 */
export const INV_090_OWNERSHIP_ENFORCED: GovernanceInvariant = {
  id: "INV_090_OWNERSHIP_ENFORCED",
  name: "Governance Ownership Enforcement Guard",
  description: "Non-admin actors attempting actions on experiments they do not own must be rejected.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.actor || !ctx.action || !ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_090_OWNERSHIP_ENFORCED",
        name: "Governance Ownership Enforcement Guard",
        severity: "critical",
      };
    }

    if (ctx.actor.role !== "admin" && ctx.action !== "create" && ctx.actor.id !== ctx.experimentDefinition.owner) {
      const decision = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("ownership");
      return {
        passed,
        invariantId: "INV_090_OWNERSHIP_ENFORCED",
        name: "Governance Ownership Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Non-admin actor modified an experiment owned by another actor.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_090_OWNERSHIP_ENFORCED",
      name: "Governance Ownership Enforcement Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #91: Admin Override. Admin can perform any permitted action on any experiment (except archived).
 */
export const INV_091_ADMIN_OVERRIDE: GovernanceInvariant = {
  id: "INV_091_ADMIN_OVERRIDE",
  name: "Governance Admin Override Guard",
  description: "Admin actors possess universal authority across all active non-archived experiments regardless of ownership.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.actor || ctx.actor.role !== "admin" || !ctx.action || !ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_091_ADMIN_OVERRIDE",
        name: "Governance Admin Override Guard",
        severity: "critical",
      };
    }

    if (ctx.experimentDefinition.status !== "archived") {
      // Check if action matches status transition rule
      let statusCompatible = true;
      switch (ctx.action) {
        case "request_review":
          statusCompatible = ctx.experimentDefinition.status === "draft";
          break;
        case "review":
          statusCompatible = ctx.experimentDefinition.status === "draft" || ctx.experimentDefinition.status === "review";
          break;
        case "approve":
          statusCompatible = ctx.experimentDefinition.status === "review";
          break;
        case "activate":
          statusCompatible = ctx.experimentDefinition.status === "approved" || ctx.experimentDefinition.status === "paused";
          break;
        case "pause":
          statusCompatible = ctx.experimentDefinition.status === "active";
          break;
        case "archive":
          statusCompatible = ctx.experimentDefinition.status === "active" || ctx.experimentDefinition.status === "paused";
          break;
      }

      if (statusCompatible) {
        const decision = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);
        const passed = decision.allowed === true && !decision.failedChecks.includes("ownership");
        return {
          passed,
          invariantId: "INV_091_ADMIN_OVERRIDE",
          name: "Governance Admin Override Guard",
          severity: "critical",
          reason: passed ? undefined : "Admin actor was incorrectly blocked by ownership check.",
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_091_ADMIN_OVERRIDE",
      name: "Governance Admin Override Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #92: Role Boundaries. Roles strictly enforce permission boundaries.
 */
export const INV_092_ROLE_BOUNDARIES: GovernanceInvariant = {
  id: "INV_092_ROLE_BOUNDARIES",
  name: "Governance Role Boundary Guard",
  description: "Actors cannot execute actions outside their declared role permissions (e.g. reviewer editing or approver activating).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.actor || !ctx.action) {
      return {
        passed: true,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
      };
    }

    // Tester roles
    if (ctx.actor.role === "reviewer" && ctx.action === "edit") {
      const decision = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("permission");
      return {
        passed,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Reviewer was allowed to edit an experiment.",
      };
    }

    if (ctx.actor.role === "approver" && ctx.action === "activate") {
      const decision = canPerformAction(ctx.actor, ctx.action, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("permission");
      return {
        passed,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Approver was allowed to activate an experiment.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_092_ROLE_BOUNDARIES",
      name: "Governance Role Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #93: Audit Order Stable. Audit history is append-only and strictly ordered.
 */
export const INV_093_AUDIT_ORDER_STABLE: GovernanceInvariant = {
  id: "INV_093_AUDIT_ORDER_STABLE",
  name: "Governance Audit Trail Stability Guard",
  description: "Governance audit log entries must preserve strict append order and immutability.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.auditLog || !Array.isArray(ctx.auditLog.entries)) {
      return {
        passed: true,
        invariantId: "INV_093_AUDIT_ORDER_STABLE",
        name: "Governance Audit Trail Stability Guard",
        severity: "critical",
      };
    }

    let isOrdered = true;
    for (let i = 1; i < ctx.auditLog.entries.length; i++) {
      if (ctx.auditLog.entries[i].timestamp.getTime() < ctx.auditLog.entries[i - 1].timestamp.getTime()) {
        isOrdered = false;
        break;
      }
    }

    return {
      passed: isOrdered,
      invariantId: "INV_093_AUDIT_ORDER_STABLE",
      name: "Governance Audit Trail Stability Guard",
      severity: "critical",
      reason: isOrdered ? undefined : "Governance audit entries violated chronological append ordering.",
    };
  },
};

/**
 * Invariant #94: Owner Required. ExperimentDefinition must contain a valid, non-empty, trimmed ownerId.
 */
export const INV_094_OWNER_REQUIRED: GovernanceInvariant = {
  id: "INV_094_OWNER_REQUIRED",
  name: "Governance Mandatory Ownership Guard",
  description: "ExperimentDefinition must contain a valid, non-empty, trimmed ownerId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_094_OWNER_REQUIRED",
        name: "Governance Mandatory Ownership Guard",
        severity: "critical",
      };
    }

    const ownerId = ctx.experimentDefinition.ownerId;
    const passed = typeof ownerId === "string" && ownerId.trim().length > 0;

    return {
      passed,
      invariantId: "INV_094_OWNER_REQUIRED",
      name: "Governance Mandatory Ownership Guard",
      severity: "critical",
      reason: passed ? undefined : "ExperimentDefinition missing mandatory non-empty ownerId.",
    };
  },
};

/**
 * Invariant #95: Audit Sequence Order. Audit log entries must have unique, non-negative, strictly monotonic sequence numbers.
 */
export const INV_095_AUDIT_SEQUENCE_ORDER: GovernanceInvariant = {
  id: "INV_095_AUDIT_SEQUENCE_ORDER",
  name: "Governance Audit Sequence Monotonicity Guard",
  description: "Audit log entries must have unique, non-negative, strictly monotonic sequence numbers.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.auditLog || !Array.isArray(ctx.auditLog.entries)) {
      return {
        passed: true,
        invariantId: "INV_095_AUDIT_SEQUENCE_ORDER",
        name: "Governance Audit Sequence Monotonicity Guard",
        severity: "critical",
      };
    }

    let valid = true;
    for (let i = 0; i < ctx.auditLog.entries.length; i++) {
      const entry = ctx.auditLog.entries[i];
      if (typeof entry.sequence !== "number" || !Number.isInteger(entry.sequence) || entry.sequence < 0) {
        valid = false;
        break;
      }
      if (i > 0 && entry.sequence <= ctx.auditLog.entries[i - 1].sequence) {
        valid = false;
        break;
      }
    }

    return {
      passed: valid,
      invariantId: "INV_095_AUDIT_SEQUENCE_ORDER",
      name: "Governance Audit Sequence Monotonicity Guard",
      severity: "critical",
      reason: valid ? undefined : "Governance audit sequence numbers are non-monotonic, non-integer, or negative.",
    };
  },
};

/**
 * Invariant #96: No Approved Candidate State. Status approved_candidate is strictly forbidden.
 */
export const INV_096_NO_APPROVED_CANDIDATE_STATE: GovernanceInvariant = {
  id: "INV_096_NO_APPROVED_CANDIDATE_STATE",
  name: "Governance Approved Candidate State Prohibition Guard",
  description: "Experiment status must be strictly one of draft, review, approved, active, paused, archived. Status approved_candidate is strictly forbidden.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_096_NO_APPROVED_CANDIDATE_STATE",
        name: "Governance Approved Candidate State Prohibition Guard",
        severity: "critical",
      };
    }

    const ALLOWED_STATES = ["draft", "review", "approved", "active", "paused", "archived"];
    const statusStr = String(ctx.experimentDefinition.status);
    const passed = ALLOWED_STATES.includes(statusStr) && statusStr !== "approved_candidate";

    return {
      passed,
      invariantId: "INV_096_NO_APPROVED_CANDIDATE_STATE",
      name: "Governance Approved Candidate State Prohibition Guard",
      severity: "critical",
      reason: passed ? undefined : `Invalid experiment status '${statusStr}'. Status 'approved_candidate' is strictly prohibited.`,
    };
  },
};

export const GOVERNANCE_INVARIANTS: readonly GovernanceInvariant[] = [
  INV_089_PERMISSION_DETERMINISTIC,
  INV_090_OWNERSHIP_ENFORCED,
  INV_091_ADMIN_OVERRIDE,
  INV_092_ROLE_BOUNDARIES,
  INV_093_AUDIT_ORDER_STABLE,
  INV_094_OWNER_REQUIRED,
  INV_095_AUDIT_SEQUENCE_ORDER,
  INV_096_NO_APPROVED_CANDIDATE_STATE,
] as const;

export function checkAllGovernanceInvariants(
  ctx: GovernanceInvariantCheckContext
): GovernanceInvariantResult[] {
  return GOVERNANCE_INVARIANTS.map((inv) => inv.check(ctx));
}
