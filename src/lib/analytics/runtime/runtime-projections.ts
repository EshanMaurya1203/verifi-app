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
// ─── VRF-ONBOARD-004A — Runtime Projections Module ─────────────────────────

import type { RuntimeResult, RuntimeAssignment } from "./runtime-types";

/**
 * Projects a RuntimeAssignment into an immutable read-only view.
 */
export function projectRuntimeAssignment(
  assignment: RuntimeAssignment
): RuntimeAssignment {
  if (!assignment) {
    throw new Error("RuntimeAssignment is required for projection.");
  }
  return Object.freeze({
    experimentId: assignment.experimentId,
    variantId: assignment.variantId,
    assignmentKey: assignment.assignmentKey,
  });
}

/**
 * Projects a RuntimeResult into an immutable read-only view.
 */
export function projectRuntimeResult(result: RuntimeResult): RuntimeResult {
  if (!result) {
    throw new Error("RuntimeResult is required for projection.");
  }
  return Object.freeze({
    assignments: Object.freeze(result.assignments.map((a) => projectRuntimeAssignment(a))),
    skipped: Object.freeze(result.skipped.map((s) => Object.freeze({ ...s }))),
    evaluatedExperiments: Object.freeze([...result.evaluatedExperiments]),
  });
}
