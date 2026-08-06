// ─── VRF-ONBOARD-004B — Exposure Engine Module ──────────────────────────────

import { ExposureValidationError } from "./exposure-errors";
import type { ExposureRequest, ExposureEvent, ExposureResult } from "./exposure-types";

import { buildExposureId, createExposureEvent } from "./exposure-utils";
import { validateExposureRequest } from "./exposure-validator";

/**
 * Deterministically records an exposure event with single-event deduplication.
 *
 * Rules:
 * 1. Validates request; throws ExposureValidationError if invalid (Option A).
 * 2. Checks existing events using exposureId `${sessionId}:${experimentId}:${variantId}`.
 * 3. Returns deeply frozen ExposureResult payload (accepted or deduplicated).
 * 4. Never mutates input arguments.
 * 5. Contains no internal time creation (new Date() forbidden).
 */
export function recordExposure(
  request: ExposureRequest,
  existing: readonly ExposureEvent[] = []
): ExposureResult {
  const validation = validateExposureRequest(request);
  if (!validation.passed) {
    throw new ExposureValidationError(
      `Invalid exposure request: ${validation.errors.join("; ")}`
    );
  }

  const exposureId = buildExposureId(
    request.sessionId,
    request.assignment.experimentId,
    request.assignment.variantId
  );

  const isDuplicate = existing.some((e) => e.exposureId === exposureId);
  const event = createExposureEvent(request);

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
