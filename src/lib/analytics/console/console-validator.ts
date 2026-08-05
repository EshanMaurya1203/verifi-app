// ─── VRF-ONBOARD-003E / 003E.1 — Console Validator ─────────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceAuditLog } from "../governance/governance-audit";
import type { ExperimentConsoleView } from "./console-types";

export interface ConsoleValidationResult {
  passed: boolean;

  errors: string[];
}

/**
 * Validates an ExperimentConsoleView projection for structural completeness, determinism, and optional domain parity.
 *
 * Rules:
 * ✓ projectionVersion === 1
 * ✓ generatedAt is valid Date
 * ✓ experimentId matches experiment.id (if experiment provided)
 * ✓ ownerId matches experiment.ownerId (if experiment provided)
 * ✓ version matches experiment.version (if experiment provided)
 * ✓ audit length matches source audit log (if auditLog provided)
 */
export function validateConsoleView(
  view: ExperimentConsoleView,
  experiment?: ExperimentDefinition,
  auditLog?: GovernanceAuditLog
): ConsoleValidationResult {
  const errors: string[] = [];

  if (!view) {
    return { passed: false, errors: ["Console view projection is missing."] };
  }

  if (view.projectionVersion !== 1) {
    errors.push("Console view projectionVersion must be exactly 1.");
  }

  if (!view.generatedAt || !(view.generatedAt instanceof Date) || isNaN(view.generatedAt.getTime())) {
    errors.push("Console view generatedAt is required and must be a valid Date object.");
  }

  if (!view.experimentId || typeof view.experimentId !== "string" || view.experimentId.trim() === "") {
    errors.push("Console view experimentId is required.");
  }

  if (!view.name || typeof view.name !== "string" || view.name.trim() === "") {
    errors.push("Console view name is required.");
  }

  if (!view.ownerId || typeof view.ownerId !== "string" || view.ownerId.trim() === "") {
    errors.push("Console view ownerId is required.");
  }

  if (!view.status || typeof view.status !== "string" || view.status.trim() === "") {
    errors.push("Console view status is required.");
  }

  if (typeof view.version !== "number" || view.version < 1) {
    errors.push("Console view version must be a number >= 1.");
  }

  // Cross-validation against source experiment if provided
  if (experiment) {
    if (view.experimentId !== experiment.id) {
      errors.push(`Console view experimentId '${view.experimentId}' does not match source experiment id '${experiment.id}'.`);
    }
    if (view.ownerId !== experiment.ownerId) {
      errors.push(`Console view ownerId '${view.ownerId}' does not match source experiment ownerId '${experiment.ownerId}'.`);
    }
    if (view.version !== experiment.version) {
      errors.push(`Console view version '${view.version}' does not match source experiment version '${experiment.version}'.`);
    }
  }

  // Variants validation
  if (!Array.isArray(view.variants) || view.variants.length < 2) {
    errors.push("Console view must contain at least 2 variants.");
  } else {
    let weightSum = 0;
    for (const v of view.variants) {
      if (!v.id || typeof v.id !== "string" || v.id.trim() === "") {
        errors.push("Variant id is required in console view.");
      }
      if (typeof v.weight !== "number" || v.weight <= 0) {
        errors.push(`Variant '${v.id}' weight must be > 0 in console view.`);
      }
      weightSum += v.weight || 0;
    }
    if (Math.abs(weightSum - 100) > 0.001) {
      errors.push(`Console view variant weights must sum to 100 (got ${weightSum}).`);
    }
  }

  // Targeting projection validation
  if (!view.targeting || typeof view.targeting.eligible !== "boolean") {
    errors.push("Console view targeting projection is incomplete.");
  }

  // Schedule projection validation
  if (!view.schedule || typeof view.schedule.active !== "boolean") {
    errors.push("Console view schedule projection is incomplete.");
  }

  // Governance projection validation
  if (!view.governance || !Array.isArray(view.governance.allowedActions)) {
    errors.push("Console view governance projection is incomplete.");
  }

  // Audit trail projection validation
  if (!Array.isArray(view.audit)) {
    errors.push("Console view audit projection must be an array.");
  } else {
    for (let i = 0; i < view.audit.length; i++) {
      const entry = view.audit[i];
      if (typeof entry.sequence !== "number" || !Number.isInteger(entry.sequence) || entry.sequence < 0) {
        errors.push(`Audit entry #${i} sequence must be an integer >= 0.`);
      }
      if (i > 0 && entry.sequence <= view.audit[i - 1].sequence) {
        errors.push(`Audit entry #${i} sequence must be strictly greater than preceding entry sequence.`);
      }
    }

    if (auditLog && Array.isArray(auditLog.entries)) {
      const sourceExpAudit = auditLog.entries.filter((e) => !experiment || e.experimentId === experiment.id);
      if (view.audit.length !== sourceExpAudit.length) {
        errors.push(`Console view audit length (${view.audit.length}) does not match source audit log count (${sourceExpAudit.length}).`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
