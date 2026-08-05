// ─── VRF-ONBOARD-004A — Runtime Utils Module ────────────────────────────────

import type { ExperimentDefinition, ExperimentVariant } from "../registry/experiment-types";
import { isEligible } from "../targeting/targeting-engine";
import { isExperimentActive } from "../scheduler/scheduler-engine";
import { canPerformAction } from "../governance/governance-engine";
import { murmur3_32 } from "../hash";
import { RuntimeAssignmentError } from "./runtime-errors";
import type { RuntimeRequest, RuntimeAssignment, RuntimeSkipped } from "./runtime-types";

/**
 * Builds a deterministic assignment key.
 * Format: sessionId:experimentId:v{version}
 */
export function buildAssignmentKey(
  sessionId: string,
  experimentId: string,
  version: number
): string {
  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
    throw new RuntimeAssignmentError("sessionId is required to build assignment key.");
  }
  if (!experimentId || typeof experimentId !== "string" || experimentId.trim() === "") {
    throw new RuntimeAssignmentError("experimentId is required to build assignment key.");
  }
  if (typeof version !== "number" || version < 1) {
    throw new RuntimeAssignmentError("version must be a positive integer.");
  }

  return `${sessionId.trim()}:${experimentId.trim()}:v${version}`;
}

/**
 * Validates variant array integrity before assignment.
 * Checks: non-empty, unique IDs, positive weights, total weight = 100.
 */
export function validateVariants(variants: readonly ExperimentVariant[]): { valid: boolean; reason?: string } {
  if (!variants || variants.length === 0) {
    return { valid: false, reason: "Experiment must contain at least one variant." };
  }

  const ids = new Set<string>();
  let totalWeight = 0;

  for (const variant of variants) {
    if (!variant.id || typeof variant.id !== "string" || variant.id.trim() === "") {
      return { valid: false, reason: "Every variant must have a non-empty string id." };
    }

    if (ids.has(variant.id)) {
      return { valid: false, reason: `Duplicate variant id: '${variant.id}'.` };
    }
    ids.add(variant.id);

    if (typeof variant.weight !== "number" || variant.weight <= 0) {
      return { valid: false, reason: `Variant '${variant.id}' weight must be a positive number (got ${variant.weight}).` };
    }

    totalWeight += variant.weight;
  }

  if (Math.round(totalWeight * 100) / 100 !== 100) {
    return { valid: false, reason: `Variant weights must sum to exactly 100 (got ${totalWeight}).` };
  }

  return { valid: true };
}

/**
 * Deterministically assigns a variant to an experiment based on assignment key hashing.
 *
 * CRITICAL: Variants are canonically sorted by id (lexicographic ascending)
 * before the bucket walk. This guarantees that the assignment result is
 * invariant to the input order of the variants array.
 */
export function assignVariant(
  experiment: ExperimentDefinition,
  assignmentKey: string
): ExperimentVariant {
  if (!experiment || !Array.isArray(experiment.variants) || experiment.variants.length === 0) {
    throw new RuntimeAssignmentError("Valid experiment definition with variants is required.");
  }
  if (!assignmentKey || typeof assignmentKey !== "string" || assignmentKey.trim() === "") {
    throw new RuntimeAssignmentError("assignmentKey is required for variant assignment.");
  }

  // Canonical sort: deterministic regardless of input order (INV_109)
  const sorted = [...experiment.variants].sort(
    (a, b) => a.id.localeCompare(b.id)
  );

  const rawHash = murmur3_32(assignmentKey.trim());
  const bucket = rawHash % 100;

  let cumulativeWeight = 0;
  for (const variant of sorted) {
    const rangeEnd = cumulativeWeight + variant.weight;
    if (bucket >= cumulativeWeight && bucket < rangeEnd) {
      return variant;
    }
    cumulativeWeight = rangeEnd;
  }

  return sorted[sorted.length - 1];
}

/**
 * Evaluates a single experiment through the runtime pipeline.
 *
 * Execution order:
 * 1. Governance check
 * 2. Lifecycle check
 * 3. Scheduler check
 * 4. Targeting check
 * 5. Variant assignment
 */
export function evaluateExperiment(
  experiment: ExperimentDefinition,
  request: RuntimeRequest
): { assignment?: RuntimeAssignment; skipped?: RuntimeSkipped } {
  if (!experiment) {
    throw new RuntimeAssignmentError("Experiment definition is required for evaluation.");
  }
  if (!request) {
    throw new RuntimeAssignmentError("RuntimeRequest is required for evaluation.");
  }

  // 1. Governance Filtering
  const govDecision = canPerformAction(request.actor, "create");
  if (!request.actor || !govDecision.allowed) {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "governance",
      },
    };
  }

  // 2. Lifecycle Filtering
  if (experiment.status === "archived") {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "archived",
      },
    };
  }

  if (experiment.status === "paused") {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "paused",
      },
    };
  }

  if (experiment.status !== "active") {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "paused",
      },
    };
  }

  // 3. Scheduler Filtering
  const schedResult = isExperimentActive(experiment, request.now);
  if (!schedResult.active) {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "schedule",
      },
    };
  }

  // 4. Targeting Filtering
  const targResult = isEligible(experiment, request.targetingContext);
  if (!targResult.eligible) {
    return {
      skipped: {
        experimentId: experiment.id,
        reason: "targeting",
      },
    };
  }

  // 5. Variant Assignment
  const key = buildAssignmentKey(request.sessionId, experiment.id, experiment.version);
  const variant = assignVariant(experiment, key);

  return {
    assignment: {
      experimentId: experiment.id,
      variantId: variant.id,
      assignmentKey: key,
    },
  };
}
