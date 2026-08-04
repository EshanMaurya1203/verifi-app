// ─── VRF-ONBOARD-001E.12C.2B — Replay Engine ────────────────────────────

import type { AssignmentAuditRecord, Experiment, ReplayResult, VariantAssignment } from "./experiments";
import { assignVariant } from "./assignment-engine";

/**
 * Replays an AssignmentAuditRecord against an Experiment definition to verify determinism.
 *
 * Recomputes:
 * ✓ assignmentHash
 * ✓ bucket allocation
 * ✓ variantId
 * ✓ experimentVersion
 */
export function replayAssignment(
  auditRecord: AssignmentAuditRecord,
  experiment: Experiment
): ReplayResult {
  if (!auditRecord) {
    throw new Error("AssignmentAuditRecord is required for replay.");
  }
  if (!experiment) {
    throw new Error("Experiment definition is required for replay.");
  }

  // Recompute assignment deterministically using audit inputs
  const replayed = assignVariant(
    auditRecord.identifier,
    auditRecord.identifierType,
    experiment
  );

  const originalAssignment: VariantAssignment = {
    experimentId: auditRecord.experimentId,
    experimentVersion: auditRecord.experimentVersion,
    variantId: auditRecord.variantId,
    assignedAt: auditRecord.assignedAt,
    assignmentHash: auditRecord.assignmentHash,
    assignmentReason: auditRecord.assignmentReason,
  };

  if (auditRecord.identifierType === "userId") {
    originalAssignment.userId = auditRecord.identifier;
  } else if (auditRecord.identifierType === "deviceId") {
    originalAssignment.deviceId = auditRecord.identifier;
  } else if (auditRecord.identifierType === "sessionId") {
    originalAssignment.sessionId = auditRecord.identifier;
  }

  const matches =
    replayed.assignment.variantId === auditRecord.variantId &&
    replayed.assignment.assignmentHash === auditRecord.assignmentHash &&
    replayed.assignment.experimentVersion === auditRecord.experimentVersion;

  return {
    matches,
    originalAssignment,
    replayedAssignment: replayed.assignment,
  };
}
