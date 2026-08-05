// ─── VRF-ONBOARD-002A — Runtime Event Storage Abstraction ───────────────

import type { RuntimeEvent } from "./runtime-types";

export interface EventStorage {
  records: RuntimeEvent[];
}

/**
 * Creates an in-memory EventStorage record store.
 */
export function createEventStorage(): EventStorage {
  return {
    records: [],
  };
}

/**
 * Persists a RuntimeEvent into storage.
 */
export function storeEvent(event: RuntimeEvent, storage: EventStorage): void {
  if (!storage || !storage.records) {
    throw new Error("EventStorage is required.");
  }
  storage.records.push(event);
}

/**
 * Retrieves all events associated with a given sessionId.
 */
export function getEventsBySession(
  sessionId: string,
  storage: EventStorage
): RuntimeEvent[] {
  if (!sessionId || !storage || !storage.records) {
    return [];
  }
  return storage.records.filter((r) => r.sessionId === sessionId);
}

/**
 * Retrieves all events associated with a given experimentId.
 */
export function getExperimentEvents(
  experimentId: string,
  storage: EventStorage
): RuntimeEvent[] {
  if (!experimentId || !storage || !storage.records) {
    return [];
  }
  return storage.records.filter((r) => r.experimentId === experimentId);
}
