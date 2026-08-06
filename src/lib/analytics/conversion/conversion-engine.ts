// ─── VRF-ONBOARD-004C — Conversion Engine Module ─────────────────────────────

import { ConversionValidationError, ConversionIntegrityError } from "./conversion-errors";
import type { GoalCandidate, GoalDefinition, ConversionEvent, ConversionResult } from "./conversion-types";
import type { ExposureEvent } from "../exposure/exposure-types";
import { buildConversionId, createConversionEvent } from "./conversion-utils";
import { validateGoalCandidate, validateConversionAttribution } from "./conversion-validator";

/**
 * Deterministically records a conversion event with 4-tuple deduplication and attribution.
 * Deduplication tuple: (sessionId, experimentId, variantId, goalId).
 *
 * Rules:
 * 1. Validates candidate and optional goal definition; throws ConversionValidationError if invalid.
 * 2. Validates exposure attribution when exposure is supplied or expected; throws ConversionIntegrityError if invalid or mismatched.
 * 3. Checks existing events using conversionId `${sessionId}:${experimentId}:${variantId}:${goalId}`.
 * 4. Returns deeply frozen ConversionResult payload (accepted or deduplicated).
 * 5. Never mutates input arguments.
 * 6. Contains no internal time creation (new Date() / Date.now() forbidden).
 */
export function recordConversion(
  candidate: GoalCandidate,
  existing: readonly ConversionEvent[] = [],
  exposureOrDefinition?: ExposureEvent | GoalDefinition,
  optionalDefinition?: GoalDefinition
): ConversionResult {
  let exposure: ExposureEvent | undefined = undefined;
  let definition: GoalDefinition | undefined = optionalDefinition;
  let attributionCheckRequested = false;

  if (arguments.length >= 3) {
    if (exposureOrDefinition && typeof exposureOrDefinition === "object") {
      if ("exposureId" in exposureOrDefinition) {
        exposure = exposureOrDefinition as ExposureEvent;
        attributionCheckRequested = true;
      } else if ("type" in exposureOrDefinition) {
        definition = exposureOrDefinition as GoalDefinition;
      }
    } else if (exposureOrDefinition === undefined) {
      attributionCheckRequested = true;
    }
  }

  const validation = validateGoalCandidate(candidate, definition);
  if (!validation.passed) {
    throw new ConversionValidationError(
      `Invalid conversion candidate: ${validation.errors.join("; ")}`
    );
  }

  if (attributionCheckRequested || exposure) {
    const attrValidation = validateConversionAttribution(exposure, candidate);
    if (!attrValidation.passed) {
      throw new ConversionIntegrityError(
        `Attribution failure: ${attrValidation.errors.join("; ")}`
      );
    }
  }

  const conversionId = buildConversionId(
    candidate.sessionId,
    candidate.experimentId,
    candidate.variantId,
    candidate.goalId
  );

  const isDuplicate = existing.some((e) => e.conversionId === conversionId);
  const event = createConversionEvent(candidate);

  if (isDuplicate) {
    return Object.freeze({
      accepted: Object.freeze([]),
      deduplicated: Object.freeze([event]),
      rejected: Object.freeze([]),
    });
  }

  return Object.freeze({
    accepted: Object.freeze([event]),
    deduplicated: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}
