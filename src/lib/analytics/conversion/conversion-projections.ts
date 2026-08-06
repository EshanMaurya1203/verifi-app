// ─── VRF-ONBOARD-004C — Conversion Projections Module ───────────────────────

import type { ConversionEvent, ConversionResult } from "./conversion-types";
import { validateConversionEvent } from "./conversion-validator";
import { ConversionValidationError } from "./conversion-errors";

/**
 * Creates a deeply frozen, read-only projection of a ConversionEvent.
 */
export function projectConversionEvent(event: ConversionEvent): Readonly<ConversionEvent> {
  const validation = validateConversionEvent(event);
  if (!validation.passed) {
    throw new ConversionValidationError(`Cannot project invalid ConversionEvent: ${validation.errors.join("; ")}`);
  }

  return Object.freeze({
    conversionId: event.conversionId,
    sessionId: event.sessionId,
    experimentId: event.experimentId,
    variantId: event.variantId,
    goalId: event.goalId,
    completedAt: new Date(event.completedAt.getTime()),
  });
}

/**
 * Creates a deeply frozen, read-only projection of a ConversionResult.
 */
export function projectConversionResult(result: ConversionResult): Readonly<ConversionResult> {
  if (!result) {
    throw new ConversionValidationError("ConversionResult is required for projection.");
  }

  const accepted = Object.freeze(result.accepted.map((e) => projectConversionEvent(e)));
  const deduplicated = Object.freeze(result.deduplicated.map((e) => projectConversionEvent(e)));
  const rejected = Object.freeze(result.rejected.map((e) => projectConversionEvent(e)));

  return Object.freeze({
    accepted,
    deduplicated,
    rejected,
  });
}

/**
 * Produces an immutable snapshot of a ConversionEvent.
 */
export function snapshotConversionEvent(event: ConversionEvent): Readonly<ConversionEvent> {
  return projectConversionEvent(event);
}
