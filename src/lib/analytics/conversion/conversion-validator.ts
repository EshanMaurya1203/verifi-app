// ─── VRF-ONBOARD-004C — Conversion Engine Validator ──────────────────────────

import type { GoalDefinition, GoalCandidate, ConversionEvent } from "./conversion-types";
import type { ExposureEvent } from "../exposure/exposure-types";
import { buildConversionId } from "./conversion-utils";

export interface ConversionValidationResult {
  passed: boolean;
  errors: string[];
}

const VALID_GOAL_TYPES = ["click", "signup", "purchase", "custom"] as const;

/**
 * Validates a GoalDefinition structure.
 */
export function validateGoalDefinition(definition: GoalDefinition): ConversionValidationResult {
  const errors: string[] = [];

  if (!definition || typeof definition !== "object") {
    return { passed: false, errors: ["GoalDefinition payload is required."] };
  }

  if (!definition.id || typeof definition.id !== "string" || definition.id.trim() === "") {
    errors.push("GoalDefinition id is required.");
  }

  if (!definition.experimentId || typeof definition.experimentId !== "string" || definition.experimentId.trim() === "") {
    errors.push("GoalDefinition experimentId is required.");
  }

  if (!definition.name || typeof definition.name !== "string" || definition.name.trim() === "") {
    errors.push("GoalDefinition name is required.");
  }

  if (!definition.type || !VALID_GOAL_TYPES.includes(definition.type as any)) {
    errors.push(`GoalDefinition type must be one of [${VALID_GOAL_TYPES.join(", ")}].`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates a GoalCandidate structure and optional GoalDefinition ownership matching.
 */
export function validateGoalCandidate(
  candidate: GoalCandidate,
  definition?: GoalDefinition
): ConversionValidationResult {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== "object") {
    return { passed: false, errors: ["GoalCandidate payload is required."] };
  }

  if (!candidate.sessionId || typeof candidate.sessionId !== "string" || candidate.sessionId.trim() === "") {
    errors.push("GoalCandidate sessionId is required.");
  }

  if (!candidate.experimentId || typeof candidate.experimentId !== "string" || candidate.experimentId.trim() === "") {
    errors.push("GoalCandidate experimentId is required.");
  }

  if (!candidate.variantId || typeof candidate.variantId !== "string" || candidate.variantId.trim() === "") {
    errors.push("GoalCandidate variantId is required.");
  }

  if (!candidate.goalId || typeof candidate.goalId !== "string" || candidate.goalId.trim() === "") {
    errors.push("GoalCandidate goalId is required.");
  }

  if (!candidate.completedAt || !(candidate.completedAt instanceof Date) || isNaN(candidate.completedAt.getTime())) {
    errors.push("GoalCandidate completedAt is required and must be a valid Date object.");
  }

  // REFINEMENT 1 — Goal Ownership Validation
  if (definition) {
    const defValidation = validateGoalDefinition(definition);
    if (!defValidation.passed) {
      errors.push(...defValidation.errors);
    } else {
      if (definition.experimentId.trim() !== candidate.experimentId.trim()) {
        errors.push(
          `Goal ownership mismatch: GoalDefinition '${definition.id}' belongs to experiment '${definition.experimentId}', but candidate specifies experiment '${candidate.experimentId}'.`
        );
      }
      if (definition.id.trim() !== candidate.goalId.trim()) {
        errors.push(
          `Goal ID mismatch: GoalDefinition id '${definition.id}' does not match candidate goalId '${candidate.goalId}'.`
        );
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a GoalCandidate is attributable to a matching ExposureEvent.
 * Rules:
 * exposure.sessionId === candidate.sessionId
 * exposure.experimentId === candidate.experimentId
 * exposure.variantId === candidate.variantId
 */
export function validateConversionAttribution(
  exposure: ExposureEvent | undefined,
  candidate: GoalCandidate
): ConversionValidationResult {
  const errors: string[] = [];

  if (!exposure || typeof exposure !== "object") {
    return {
      passed: false,
      errors: ["Conversion candidate requires a valid ExposureEvent for attribution."],
    };
  }

  if (exposure.sessionId.trim() !== candidate.sessionId.trim()) {
    errors.push(`Session ID attribution mismatch: Exposure '${exposure.sessionId}', Candidate '${candidate.sessionId}'.`);
  }

  if (exposure.experimentId.trim() !== candidate.experimentId.trim()) {
    errors.push(`Experiment ID attribution mismatch: Exposure '${exposure.experimentId}', Candidate '${candidate.experimentId}'.`);
  }

  if (exposure.variantId.trim() !== candidate.variantId.trim()) {
    errors.push(`Variant ID attribution mismatch: Exposure '${exposure.variantId}', Candidate '${candidate.variantId}'.`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates a ConversionEvent structure and ID integrity.
 */
export function validateConversionEvent(event: ConversionEvent): ConversionValidationResult {
  const errors: string[] = [];

  if (!event || typeof event !== "object") {
    return { passed: false, errors: ["ConversionEvent payload is required."] };
  }

  if (!event.conversionId || typeof event.conversionId !== "string" || event.conversionId.trim() === "") {
    errors.push("ConversionEvent conversionId is required.");
  }

  if (!event.sessionId || typeof event.sessionId !== "string" || event.sessionId.trim() === "") {
    errors.push("ConversionEvent sessionId is required.");
  }

  if (!event.experimentId || typeof event.experimentId !== "string" || event.experimentId.trim() === "") {
    errors.push("ConversionEvent experimentId is required.");
  }

  if (!event.variantId || typeof event.variantId !== "string" || event.variantId.trim() === "") {
    errors.push("ConversionEvent variantId is required.");
  }

  if (!event.goalId || typeof event.goalId !== "string" || event.goalId.trim() === "") {
    errors.push("ConversionEvent goalId is required.");
  }

  if (!event.completedAt || !(event.completedAt instanceof Date) || isNaN(event.completedAt.getTime())) {
    errors.push("ConversionEvent completedAt is required and must be a valid Date object.");
  }

  if (event.sessionId && event.experimentId && event.variantId && event.goalId && event.conversionId) {
    const expectedId = buildConversionId(event.sessionId, event.experimentId, event.variantId, event.goalId);
    if (event.conversionId !== expectedId) {
      errors.push(`ConversionEvent conversionId '${event.conversionId}' does not match expected '${expectedId}'.`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

