// ─── VRF-ONBOARD-001E.12C.2A — Assignment Migration Engine ────────────

import type { AssignmentMigrationResult, IdentityContext, VariantAssignment } from "./experiments";

/**
 * Migrates an anonymous device/session assignment to a authenticated userId.
 *
 * Immutable Preservation Rules:
 * ✓ variantId must NEVER change
 * ✓ assignmentHash must NEVER change
 * ✓ experimentVersion must NEVER change
 * ✓ assignmentReason becomes "migration"
 */
export function migrateAssignment(
  identity: IdentityContext,
  assignment: VariantAssignment
): AssignmentMigrationResult {
  if (!assignment) {
    throw new Error("VariantAssignment is required for migration.");
  }

  // If no new userId is provided or assignment already has matching userId, no migration needed
  if (!identity || !identity.userId || identity.userId.trim() === "" || assignment.userId === identity.userId) {
    return {
      migrated: false,
      assignment,
    };
  }

  const previousIdentifierType: "deviceId" | "sessionId" = assignment.deviceId
    ? "deviceId"
    : "sessionId";

  const migratedAssignment: VariantAssignment = {
    ...assignment,
    userId: identity.userId.trim(),
    assignmentReason: "migration",
  };

  return {
    migrated: true,
    previousIdentifierType,
    newIdentifierType: "userId",
    assignment: migratedAssignment,
  };
}
