// ─── VRF-ONBOARD-004B — Exposure Tracking Utils ─────────────────────────────

import { ExposureIntegrityError } from "./exposure-errors";
import type { ExposureRequest, ExposureEvent } from "./exposure-types";

/**
 * Builds a deterministic exposure identifier.
 * Format: ${sessionId}:${experimentId}:${variantId}
 */
export function buildExposureId(
  sessionId: string,
  experimentId: string,
  variantId: string
): string {
  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
    throw new ExposureIntegrityError("sessionId is required for exposure identifier.");
  }
  if (!experimentId || typeof experimentId !== "string" || experimentId.trim() === "") {
    throw new ExposureIntegrityError("experimentId is required for exposure identifier.");
  }
  if (!variantId || typeof variantId !== "string" || variantId.trim() === "") {
    throw new ExposureIntegrityError("variantId is required for exposure identifier.");
  }

  return `${sessionId.trim()}:${experimentId.trim()}:${variantId.trim()}`;
}

/**
 * Constructs and deeply freezes an ExposureEvent object from a validated ExposureRequest.
 */
export function createExposureEvent(request: ExposureRequest): ExposureEvent {
  if (!request || !request.assignment) {
    throw new ExposureIntegrityError("ExposureRequest with assignment is required.");
  }

  const exposureId = buildExposureId(
    request.sessionId,
    request.assignment.experimentId,
    request.assignment.variantId
  );

  return Object.freeze({
    exposureId,
    sessionId: request.sessionId.trim(),
    experimentId: request.assignment.experimentId.trim(),
    variantId: request.assignment.variantId.trim(),
    assignmentKey: request.assignment.assignmentKey.trim(),
    seenAt: request.seenAt,
  });
}
