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
// ─── VRF-ONBOARD-002A / 002Y — Runtime Event Queue (FIFO & Dead-Letter) ──

import type { QueuedEvent } from "./queue-types";
import { MAX_RETRIES } from "./queue-types";
import type { RuntimeEvent } from "./runtime-types";

export interface EventQueue {
  items: QueuedEvent[];
  deadLetterItems: QueuedEvent[];
  events: RuntimeEvent[];
}

/**
 * Creates an in-memory FIFO EventQueue supporting retry failure semantics and a Dead Letter Queue.
 */
export function createEventQueue(): EventQueue {
  const items: QueuedEvent[] = [];
  const deadLetterItems: QueuedEvent[] = [];

  const queue: EventQueue = {
    items,
    deadLetterItems,
    get events() {
      return items.map((i) => i.event);
    },
  };

  return queue;
}

/**
 * Enqueues a RuntimeEvent as a pending QueuedEvent at the back of the queue (FIFO order).
 */
export function enqueueEvent(event: RuntimeEvent, queue: EventQueue): QueuedEvent {
  if (!queue || !queue.items) {
    throw new Error("EventQueue is required.");
  }
  if (!event) {
    throw new Error("RuntimeEvent is required.");
  }

  const queued: QueuedEvent = {
    event,
    retries: 0,
    status: "pending",
  };

  queue.items.push(queued);
  return queued;
}

/**
 * Dequeues and removes the front pending/failed QueuedEvent from the queue (FIFO order).
 * Returns null if the queue is empty.
 */
export function dequeueEvent(queue: EventQueue): RuntimeEvent | null {
  if (!queue || !queue.items || queue.items.length === 0) {
    return null;
  }
  const queued = queue.items.shift();
  return queued ? queued.event : null;
}

/**
 * Inspects the front event of the queue without removing it.
 */
export function peekEvent(queue: EventQueue): RuntimeEvent | null {
  if (!queue || !queue.items || queue.items.length === 0) {
    return null;
  }
  return queue.items[0].event;
}

/**
 * Retrieves all events currently residing in the Dead Letter Queue.
 */
export function getDeadLetterEvents(queue: EventQueue): QueuedEvent[] {
  if (!queue || !queue.deadLetterItems) {
    return [];
  }
  return [...queue.deadLetterItems];
}

/**
 * Restores all dead-letter events back to the active queue with reset retries and status "pending".
 * Returns the number of events restored.
 */
export function retryFailedEvents(queue: EventQueue): number {
  if (!queue || !queue.deadLetterItems || queue.deadLetterItems.length === 0) {
    return 0;
  }

  const restored = queue.deadLetterItems.splice(0, queue.deadLetterItems.length);
  for (const item of restored) {
    item.retries = 0;
    item.status = "pending";
    item.lastError = undefined;
    queue.items.push(item);
  }

  return restored.length;
}

/**
 * Clears all entries from the Dead Letter Queue.
 */
export function clearDeadLetterQueue(queue: EventQueue): void {
  if (!queue || !queue.deadLetterItems) {
    return;
  }
  queue.deadLetterItems.length = 0;
}
