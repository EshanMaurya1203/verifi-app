/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-004A — Runtime Validator Module ───────────────────────────

import type { RuntimeRequest, RuntimeResult } from "./runtime-types";

export interface RuntimeValidationResult {
  passed: boolean;

  errors: string[];
}

/**
 * Validates a RuntimeRequest payload.
 */
export function validateRuntimeRequest(request: RuntimeRequest): RuntimeValidationResult {
  const errors: string[] = [];

  if (!request) {
    return { passed: false, errors: ["RuntimeRequest payload is required."] };
  }

  if (!request.sessionId || typeof request.sessionId !== "string" || request.sessionId.trim() === "") {
    errors.push("RuntimeRequest sessionId is required and must be a non-empty string.");
  }

  if (!request.actor || typeof request.actor !== "object") {
    errors.push("RuntimeRequest actor is required.");
  } else {
    if (!request.actor.id || typeof request.actor.id !== "string" || request.actor.id.trim() === "") {
      errors.push("RuntimeRequest actor id is required.");
    }
    const VALID_ROLES = ["author", "reviewer", "approver", "admin"];
    if (!request.actor.role || !VALID_ROLES.includes(request.actor.role)) {
      errors.push(`RuntimeRequest actor role must be one of [${VALID_ROLES.join(", ")}].`);
    }
  }

  if (!request.targetingContext || typeof request.targetingContext !== "object") {
    errors.push("RuntimeRequest targetingContext is required.");
  }

  if (!request.now || !(request.now instanceof Date) || isNaN(request.now.getTime())) {
    errors.push("RuntimeRequest now is required and must be a valid Date object.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates a RuntimeResult payload.
 */
export function validateRuntimeResult(result: RuntimeResult): RuntimeValidationResult {
  const errors: string[] = [];

  if (!result) {
    return { passed: false, errors: ["RuntimeResult payload is required."] };
  }

  if (!Array.isArray(result.assignments)) {
    errors.push("RuntimeResult assignments must be an array.");
  } else {
    const seenExpIds = new Set<string>();
    for (const assignment of result.assignments) {
      if (!assignment.experimentId) {
        errors.push("RuntimeAssignment experimentId is required.");
      } else if (seenExpIds.has(assignment.experimentId)) {
        errors.push(`Duplicate RuntimeAssignment experimentId: '${assignment.experimentId}'.`);
      } else {
        seenExpIds.add(assignment.experimentId);
      }

      if (!assignment.variantId) {
        errors.push("RuntimeAssignment variantId is required.");
      }

      if (!assignment.assignmentKey) {
        errors.push("RuntimeAssignment assignmentKey is required.");
      }
    }
  }

  if (!Array.isArray(result.skipped)) {
    errors.push("RuntimeResult skipped must be an array.");
  } else {
    const VALID_REASONS = ["governance", "schedule", "targeting", "archived", "paused"];
    for (const skipped of result.skipped) {
      if (!skipped.experimentId) {
        errors.push("RuntimeSkipped experimentId is required.");
      }
      if (!skipped.reason || !VALID_REASONS.includes(skipped.reason)) {
        errors.push(`RuntimeSkipped reason must be one of [${VALID_REASONS.join(", ")}].`);
      }
    }
  }

  if (!Array.isArray(result.evaluatedExperiments)) {
    errors.push("RuntimeResult evaluatedExperiments must be an array.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
