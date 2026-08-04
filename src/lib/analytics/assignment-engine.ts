// ─── VRF-ONBOARD-001E.12C.1A — Deterministic Assignment Engine (Hardened) ───

import type {
  AssignmentResult,
  Experiment,
  IdentifierType,
  VariantAssignment,
} from "./experiments";
import { computeAssignmentHash } from "./hash";
import { resolveVariant } from "./allocation-resolver";

/**
 * Deterministically assigns a founder to an ExperimentVariant.
 *
 * Hardening guarantees:
 * 1. Requires explicit identifierType ("userId" | "deviceId" | "sessionId") — NO prefix inspection.
 * 2. Returns AssignmentResult containing stable deterministicKey (`identifier:experimentId:vVersion`).
 * 3. Timestamps strictly reside in VariantAssignment for audit logging, ignored during deterministic comparisons.
 */
export function assignVariant(
  identifier: string,
  identifierType: IdentifierType,
  experiment: Experiment
): AssignmentResult {
  if (!identifier || identifier.trim() === "") {
    throw new Error("Assignment identifier cannot be empty.");
  }
  if (!identifierType || !["userId", "deviceId", "sessionId"].includes(identifierType)) {
    throw new Error(`Explicit identifierType must be 'userId', 'deviceId', or 'sessionId' (got '${identifierType}').`);
  }
  if (!experiment) {
    throw new Error("Experiment payload is required.");
  }

  const idTrim = identifier.trim();

  const { hash, bucket } = computeAssignmentHash(
    idTrim,
    experiment.id,
    experiment.version
  );

  const selectedVariant = resolveVariant(bucket, experiment.variants);

  const deterministicKey = `${idTrim}:${experiment.id}:v${experiment.version}`;

  const assignment: VariantAssignment = {
    experimentId: experiment.id,
    experimentVersion: experiment.version,
    variantId: selectedVariant.id,
    assignedAt: new Date(),
    assignmentHash: hash,
    assignmentReason: "hash",
  };

  // Assign explicitly based on identifierType parameter (no prefix guessing)
  if (identifierType === "userId") {
    assignment.userId = idTrim;
  } else if (identifierType === "deviceId") {
    assignment.deviceId = idTrim;
  } else if (identifierType === "sessionId") {
    assignment.sessionId = idTrim;
  }

  return {
    assignment,
    deterministicKey,
  };
}
