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
// ─── VRF-ONBOARD-002A / 002X — Event Ingestion Pipeline ──────────────────

import type { EventQueue } from "./event-queue";
import { enqueueEvent } from "./event-queue";
import type { EventStorage } from "./event-storage";
import type { RuntimeEvent } from "./runtime-types";
import { validateEvent } from "./event-validator";

/**
 * Ingests a RuntimeEvent by validating it and pushing it onto the FIFO EventQueue.
 *
 * VRF-ONBOARD-002X: Real Queue Architecture — Storage is decoupled from ingestion.
 * Events are enqueued here and processed asynchronously/in batches by EventProcessor into EventStorage.
 */
export function ingestEvent(
  event: RuntimeEvent,
  queue: EventQueue,
  _storage?: EventStorage
): RuntimeEvent {
  if (!queue) {
    throw new Error("EventQueue is required.");
  }

  // 1. Validate event structure and mandatory invariant fields
  const validation = validateEvent(event);
  if (!validation.valid) {
    throw new Error(`Event validation failed: ${validation.errors.join("; ")}`);
  }

  // 2. Enqueue event into FIFO queue (enqueueEvent signature is enqueueEvent(event, queue))
  enqueueEvent(event, queue);

  return event;
}
