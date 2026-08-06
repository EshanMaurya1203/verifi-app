// ─── VRF-ONBOARD-004C — Conversion Engine Utils ──────────────────────────────

import { ConversionIntegrityError } from "./conversion-errors";
import type { GoalCandidate, ConversionEvent } from "./conversion-types";

/**
 * Builds a deterministic conversion identifier.
 * Format: ${sessionId}:${experimentId}:${variantId}:${goalId}
 */
export function buildConversionId(
  sessionId: string,
  experimentId: string,
  variantId: string,
  goalId: string
): string {
  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
    throw new ConversionIntegrityError("sessionId is required for conversion identifier.");
  }
  if (!experimentId || typeof experimentId !== "string" || experimentId.trim() === "") {
    throw new ConversionIntegrityError("experimentId is required for conversion identifier.");
  }
  if (!variantId || typeof variantId !== "string" || variantId.trim() === "") {
    throw new ConversionIntegrityError("variantId is required for conversion identifier.");
  }
  if (!goalId || typeof goalId !== "string" || goalId.trim() === "") {
    throw new ConversionIntegrityError("goalId is required for conversion identifier.");
  }

  return `${sessionId.trim()}:${experimentId.trim()}:${variantId.trim()}:${goalId.trim()}`;
}

/**
 * Constructs and deeply freezes a ConversionEvent object from a validated GoalCandidate.
 */
export function createConversionEvent(candidate: GoalCandidate): ConversionEvent {
  if (!candidate) {
    throw new ConversionIntegrityError("GoalCandidate is required to create ConversionEvent.");
  }

  const conversionId = buildConversionId(
    candidate.sessionId,
    candidate.experimentId,
    candidate.variantId,
    candidate.goalId
  );

  return Object.freeze({
    conversionId,
    sessionId: candidate.sessionId.trim(),
    experimentId: candidate.experimentId.trim(),
    variantId: candidate.variantId.trim(),
    goalId: candidate.goalId.trim(),
    completedAt: candidate.completedAt,
  });
}
