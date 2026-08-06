// ─── VRF-ONBOARD-004B — Exposure Tracking Validator ─────────────────────────

import type { ExposureRequest, ExposureEvent } from "./exposure-types";
import { buildExposureId } from "./exposure-utils";

export interface ExposureValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates an ExposureRequest structure.
 */
export function validateExposureRequest(request: ExposureRequest): ExposureValidationResult {
  const errors: string[] = [];

  if (!request || typeof request !== "object") {
    return { passed: false, errors: ["ExposureRequest payload is required."] };
  }

  if (!request.sessionId || typeof request.sessionId !== "string" || request.sessionId.trim() === "") {
    errors.push("ExposureRequest sessionId is required and must be a non-empty string.");
  }

  if (!request.assignment || typeof request.assignment !== "object") {
    errors.push("ExposureRequest assignment is required.");
  } else {
    if (!request.assignment.experimentId || typeof request.assignment.experimentId !== "string" || request.assignment.experimentId.trim() === "") {
      errors.push("ExposureRequest assignment experimentId is required.");
    }
    if (!request.assignment.variantId || typeof request.assignment.variantId !== "string" || request.assignment.variantId.trim() === "") {
      errors.push("ExposureRequest assignment variantId is required.");
    }
    if (!request.assignment.assignmentKey || typeof request.assignment.assignmentKey !== "string" || request.assignment.assignmentKey.trim() === "") {
      errors.push("ExposureRequest assignment assignmentKey is required.");
    }
  }

  if (!request.seenAt || !(request.seenAt instanceof Date) || isNaN(request.seenAt.getTime())) {
    errors.push("ExposureRequest seenAt is required and must be a valid Date object.");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Validates an ExposureEvent structure and ID integrity.
 */
export function validateExposureEvent(event: ExposureEvent): ExposureValidationResult {
  const errors: string[] = [];

  if (!event || typeof event !== "object") {
    return { passed: false, errors: ["ExposureEvent payload is required."] };
  }

  if (!event.exposureId || typeof event.exposureId !== "string" || event.exposureId.trim() === "") {
    errors.push("ExposureEvent exposureId is required.");
  }

  if (!event.sessionId || typeof event.sessionId !== "string" || event.sessionId.trim() === "") {
    errors.push("ExposureEvent sessionId is required.");
  }

  if (!event.experimentId || typeof event.experimentId !== "string" || event.experimentId.trim() === "") {
    errors.push("ExposureEvent experimentId is required.");
  }

  if (!event.variantId || typeof event.variantId !== "string" || event.variantId.trim() === "") {
    errors.push("ExposureEvent variantId is required.");
  }

  if (!event.assignmentKey || typeof event.assignmentKey !== "string" || event.assignmentKey.trim() === "") {
    errors.push("ExposureEvent assignmentKey is required.");
  }

  if (!event.seenAt || !(event.seenAt instanceof Date) || isNaN(event.seenAt.getTime())) {
    errors.push("ExposureEvent seenAt is required and must be a valid Date object.");
  }

  if (event.sessionId && event.experimentId && event.variantId && event.exposureId) {
    const expectedId = buildExposureId(event.sessionId, event.experimentId, event.variantId);
    if (event.exposureId !== expectedId) {
      errors.push(`ExposureEvent exposureId '${event.exposureId}' does not match expected '${expectedId}'.`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
