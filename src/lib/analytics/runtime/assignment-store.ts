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
// ─── VRF-ONBOARD-002B / 002X — Sticky Assignment Store ───────────────────

import type { RouterResult } from "./router-types";

export interface AssignmentStore {
  assignments: Map<string, RouterResult>;
}

/**
 * Creates an in-memory AssignmentStore.
 */
export function createAssignmentStore(): AssignmentStore {
  return {
    assignments: new Map<string, RouterResult>(),
  };
}

/**
 * Generates version-aware assignment store key.
 *
 * Format: `${sessionId}:${experimentId}:v${version}`
 */
export function buildAssignmentStoreKey(
  sessionId: string,
  experimentId: string,
  version: number = 1
): string {
  return `${sessionId}:${experimentId}:v${version}`;
}

/**
 * Retrieves sticky assignment for a given session, experiment, and version.
 * If experiment version changes, sticky assignment lookup for old version will return undefined.
 */
export function getAssignment(
  sessionId: string,
  experimentId: string,
  version: number = 1,
  store: AssignmentStore
): RouterResult | undefined {
  if (!sessionId || !experimentId || !store || !store.assignments) {
    return undefined;
  }

  const key = buildAssignmentStoreKey(sessionId, experimentId, version);
  const result = store.assignments.get(key);

  if (result) {
    return {
      ...result,
      sticky: true,
    };
  }

  return undefined;
}

/**
 * Saves assignment into store keyed by session, experiment ID, and version.
 */
export function saveAssignment(
  result: RouterResult,
  sessionId: string,
  version: number = 1,
  store: AssignmentStore
): void {
  if (!result || !sessionId || !store || !store.assignments) {
    return;
  }

  const key = buildAssignmentStoreKey(sessionId, result.experimentId, version);
  store.assignments.set(key, {
    ...result,
    sticky: true,
  });
}
