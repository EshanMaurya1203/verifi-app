// ─── VRF-ONBOARD-004B — Exposure Projections Module ────────────────────────

import type { ExposureEvent, ExposureResult } from "./exposure-types";
import { validateExposureEvent } from "./exposure-validator";
import { ExposureValidationError } from "./exposure-errors";

/**
 * Creates a deeply frozen, read-only projection of an ExposureEvent.
 */
export function projectExposureEvent(event: ExposureEvent): Readonly<ExposureEvent> {
  const validation = validateExposureEvent(event);
  if (!validation.passed) {
    throw new ExposureValidationError(`Cannot project invalid ExposureEvent: ${validation.errors.join("; ")}`);
  }

  return Object.freeze({
    exposureId: event.exposureId,
    sessionId: event.sessionId,
    experimentId: event.experimentId,
    variantId: event.variantId,
    assignmentKey: event.assignmentKey,
    seenAt: new Date(event.seenAt.getTime()),
  });
}

/**
 * Creates a deeply frozen, read-only projection of an ExposureResult.
 */
export function projectExposureResult(result: ExposureResult): Readonly<ExposureResult> {
  if (!result) {
    throw new ExposureValidationError("ExposureResult is required for projection.");
  }

  const accepted = Object.freeze(result.accepted.map((e) => projectExposureEvent(e)));
  const deduplicated = Object.freeze(result.deduplicated.map((e) => projectExposureEvent(e)));
  const rejected = Object.freeze(result.rejected.map((e) => projectExposureEvent(e)));

  return Object.freeze({
    accepted,
    deduplicated,
    rejected,
  });
}

/**
 * Produces an immutable snapshot of an ExposureEvent.
 */
export function snapshotExposureEvent(event: ExposureEvent): Readonly<ExposureEvent> {
  return projectExposureEvent(event);
}
