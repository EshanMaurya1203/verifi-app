// ─── VRF-ONBOARD-001E.12C.2A — Identity Resolution Engine ──────────────

import type { IdentityContext, IdentifierType } from "./experiments";

/**
 * Resolves the primary identifier type from an IdentityContext using strict priority:
 *
 * Priority: userId → deviceId → sessionId
 *
 * @throws {Error} if identity is null/undefined or contains no non-empty identifiers.
 */
export function resolveIdentity(
  identity: IdentityContext
): IdentifierType {
  if (!identity) {
    throw new Error("IdentityContext payload is required.");
  }

  if (identity.userId && identity.userId.trim() !== "") {
    return "userId";
  }

  if (identity.deviceId && identity.deviceId.trim() !== "") {
    return "deviceId";
  }

  if (identity.sessionId && identity.sessionId.trim() !== "") {
    return "sessionId";
  }

  throw new Error("At least one identifier (userId, deviceId, or sessionId) must be non-empty.");
}
