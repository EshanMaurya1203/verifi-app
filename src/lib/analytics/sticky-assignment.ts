// ─── VRF-ONBOARD-001E.12C.2A — Sticky Assignment Lookup Engine ─────────

import type { IdentityContext, StickyAssignmentResult, VariantAssignment } from "./experiments";

/**
 * Searches an array of existing assignments for a sticky match using strict priority:
 *
 * 1. userId match  → source: "userId"
 * 2. deviceId match → source: "deviceId"
 * 3. sessionId match → source: "sessionId"
 *
 * If no match is found, returns { found: false }.
 */
export function findStickyAssignment(
  identity: IdentityContext,
  assignments: VariantAssignment[]
): StickyAssignmentResult {
  if (!identity || !assignments || assignments.length === 0) {
    return { found: false };
  }

  // 1. Priority 1: userId match
  if (identity.userId && identity.userId.trim() !== "") {
    const userMatch = assignments.find((a) => a.userId === identity.userId);
    if (userMatch) {
      return {
        found: true,
        assignment: userMatch,
        source: "userId",
      };
    }
  }

  // 2. Priority 2: deviceId match
  if (identity.deviceId && identity.deviceId.trim() !== "") {
    const deviceMatch = assignments.find((a) => a.deviceId === identity.deviceId);
    if (deviceMatch) {
      return {
        found: true,
        assignment: deviceMatch,
        source: "deviceId",
      };
    }
  }

  // 3. Priority 3: sessionId match
  if (identity.sessionId && identity.sessionId.trim() !== "") {
    const sessionMatch = assignments.find((a) => a.sessionId === identity.sessionId);
    if (sessionMatch) {
      return {
        found: true,
        assignment: sessionMatch,
        source: "sessionId",
      };
    }
  }

  return { found: false };
}
