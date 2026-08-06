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
// ─── VRF-ONBOARD-002B / 002X — Deterministic Experiment Router Engine ───

import { computeAssignmentHash } from "../hash";
import type { EventQueue } from "./event-queue";
import type { EventStorage } from "./event-storage";
import { trackExperimentAssignment } from "./event-tracker";
import { ingestEvent } from "./event-ingestion";
import type { AssignmentStore } from "./assignment-store";
import { getAssignment, saveAssignment } from "./assignment-store";
import { detectConflict } from "./router-conflicts";
import type {
  RouterContext,
  RouterExperimentVariant,
  RouterResult,
  RuntimeExperiment,
} from "./router-types";

/**
 * Selects a variant deterministically based on MurmurHash3 bucket (0–99) and variant weights.
 *
 * VRF-ONBOARD-002X Weight Precision Fix:
 * Removes all Math.round() call. Mathematically exact float check bucket < cumulativeWeight.
 */
export function selectVariant(
  sessionId: string,
  experimentId: string,
  variants: RouterExperimentVariant[],
  version: number = 1
): string {
  if (!variants || variants.length === 0) {
    throw new Error("Experiment must contain at least one variant.");
  }

  if (variants.length === 1) {
    return variants[0].id;
  }

  const { bucket } = computeAssignmentHash(sessionId, experimentId, version);

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) {
    return variants[0].id;
  }

  let cumulativeWeight = 0;
  for (const variant of variants) {
    const allocatedBuckets = (variant.weight / totalWeight) * 100;
    cumulativeWeight += allocatedBuckets;

    // Mathematically exact check: bucket < cumulativeWeight (NO Math.round!)
    if (bucket < cumulativeWeight) {
      return variant.id;
    }
  }

  return variants[variants.length - 1].id;
}

/**
 * Master experiment router function evaluating eligibility, conflicts, versioned sticky assignments,
 * forced variants, weighted distribution, storage persistence, and runtime event ingestion.
 *
 * VRF-ONBOARD-002X: Versioned sticky assignments & exact weight precision.
 */
export function routeExperiment(
  context: RouterContext,
  experiment: RuntimeExperiment,
  store: AssignmentStore,
  assignedExperiments?: RouterResult[],
  queue?: EventQueue,
  storage?: EventStorage,
  forcedVariantId?: string
): RouterResult | null {
  if (!context || !context.sessionId) {
    throw new Error("RouterContext with sessionId is required.");
  }

  if (!experiment) {
    throw new Error("RuntimeExperiment is required.");
  }

  // 1. Check if experiment is enabled
  if (!experiment.enabled) {
    return null;
  }

  const version = experiment.version || 1;

  // 2. Conflict detection against already assigned experiments
  if (detectConflict(experiment, assignedExperiments || [])) {
    return null;
  }

  // 3. Versioned sticky assignment lookup
  const stickyAssignment = getAssignment(context.sessionId, experiment.id, version, store);
  if (stickyAssignment) {
    return stickyAssignment;
  }

  // 4. Forced variant override (VRF-ONBOARD-002D)
  let variantId: string;
  if (forcedVariantId) {
    const variantExists = experiment.variants.some((v) => v.id === forcedVariantId);
    if (!variantExists) {
      return null;
    }
    variantId = forcedVariantId;
  } else {
    // 5. Deterministic weighted assignment (VRF-ONBOARD-002X)
    variantId = selectVariant(context.sessionId, experiment.id, experiment.variants, version);
  }

  const result: RouterResult = {
    experimentId: experiment.id,
    variantId,
    sticky: false,
    assignedAt: new Date(),
  };

  // 6. Persist into assignment store with version keying
  saveAssignment(result, context.sessionId, version, store);

  // 7. Runtime event integration (VRF-ONBOARD-002A)
  if (queue) {
    const assignmentEvent = trackExperimentAssignment(
      context.sessionId,
      experiment.id,
      variantId,
      context.userId
    );
    ingestEvent(assignmentEvent, queue, storage);
  }

  return result;
}
