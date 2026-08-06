/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-002C / 002Y — Deterministic Session Recovery Module ───

import { murmur3_32 } from "../hash";
import { generateIdentityId } from "./identity";
import type { RuntimeRequest } from "./middleware-types";

/**
 * Generates a deterministic, cross-page sessionId based on identity (userId > anonymousId > userAgent).
 *
 * Rules:
 * - Completely independent of request.pathname (cross-page session stability)
 * - Same identity → same sessionId across /dashboard, /leaderboard, /pricing, etc.
 * - Output format: sess_<8-char-hex-hash>
 */
export function generateDeterministicSessionId(request: RuntimeRequest): string {
  const identityId = generateIdentityId({
    userId: request ? request.userId : undefined,
    anonymousId: request ? request.anonymousId : undefined,
    userAgent: request ? request.userAgent : undefined,
  });

  const rawHash = murmur3_32(identityId);
  const hexHash = rawHash.toString(16).padStart(8, "0");

  return `sess_${hexHash}`;
}

/**
 * Recovers an existing sessionId or deterministically generates a cross-page session ID for a RuntimeRequest.
 */
export function recoverSession(request: RuntimeRequest): string {
  if (request && request.sessionId && typeof request.sessionId === "string" && request.sessionId.trim() !== "") {
    return request.sessionId.trim();
  }

  return generateDeterministicSessionId(request);
}
