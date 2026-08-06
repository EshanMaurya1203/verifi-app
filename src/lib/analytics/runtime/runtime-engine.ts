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
// ─── VRF-ONBOARD-004A — Runtime Engine Module ────────────────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import { validateRuntimeRequest } from "./runtime-validator";
import { evaluateExperiment } from "./runtime-utils";
import { RuntimeValidationError } from "./runtime-errors";
import type {
  RuntimeRequest,
  RuntimeResult,
  RuntimeAssignment,
  RuntimeSkipped,
} from "./runtime-types";

/**
 * Orchestrates deterministic experiment execution.
 *
 * Rules:
 * ✓ Deterministic evaluation order: PRIMARY = id, SECONDARY = version
 * ✓ Immutable execution: never mutates input experiments or request
 * ✓ Read-only evaluation
 * ✓ Orchestration only: logic delegates to evaluateExperiment()
 */
export function executeRuntime(
  request: RuntimeRequest,
  experiments: ExperimentDefinition[]
): RuntimeResult {
  const validation = validateRuntimeRequest(request);
  if (!validation.passed) {
    throw new RuntimeValidationError(`Invalid RuntimeRequest: ${validation.errors.join("; ")}`);
  }
  if (!Array.isArray(experiments)) {
    throw new RuntimeValidationError("Experiments parameter must be an array.");
  }

  // Primary sort by experiment.id, Secondary sort by version
  const sortedExperiments = [...experiments].sort((a, b) => {
    if (a.id !== b.id) {
      return a.id.localeCompare(b.id);
    }
    return a.version - b.version;
  });

  const assignments: RuntimeAssignment[] = [];
  const skipped: RuntimeSkipped[] = [];
  const evaluatedExperiments: string[] = [];

  for (const experiment of sortedExperiments) {
    if (!experiment || !experiment.id) continue;

    evaluatedExperiments.push(experiment.id);

    const outcome = evaluateExperiment(experiment, request);
    if (outcome.assignment) {
      assignments.push(outcome.assignment);
    } else if (outcome.skipped) {
      skipped.push(outcome.skipped);
    }
  }

  return Object.freeze({
    assignments: Object.freeze(assignments.map((a) => Object.freeze({ ...a }))),
    skipped: Object.freeze(skipped.map((s) => Object.freeze({ ...s }))),
    evaluatedExperiments: Object.freeze([...evaluatedExperiments]),
  });
}
