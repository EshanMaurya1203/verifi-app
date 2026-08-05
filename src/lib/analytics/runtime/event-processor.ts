// ─── VRF-ONBOARD-002X / 002Y — Real Queue Event Processor Module ─────────

import type { EventQueue } from "./event-queue";
import type { QueuedEvent } from "./queue-types";
import { MAX_RETRIES } from "./queue-types";
import type { EventStorage } from "./event-storage";
import { storeEvent } from "./event-storage";
import type { RuntimeEvent } from "./runtime-types";

export interface EventProcessor {
  processNext(simulateFailureError?: string): RuntimeEvent | null;

  processBatch(batchSize: number): RuntimeEvent[];

  pendingCount(): number;

  isEmpty(): boolean;
}

/**
 * Creates an EventProcessor instance enforcing queue processing failure semantics and Dead-Letter Queue escalation.
 *
 * Behavior:
 * pending → processing → success (stored, removed from queue)
 *                       → failure (retries + 1)
 *                            └ if retries >= MAX_RETRIES (3) → status = "dead_letter", moved to deadLetterItems
 */
export function createEventProcessor(
  queue: EventQueue,
  storage: EventStorage
): EventProcessor {
  if (!queue || !storage) {
    throw new Error("EventQueue and EventStorage are required.");
  }

  return {
    processNext(simulateFailureError?: string): RuntimeEvent | null {
      if (!queue.items || queue.items.length === 0) {
        return null;
      }

      // Dequeue front item
      const item = queue.items.shift()!;
      item.status = "processing";

      // Process event storage write (or handle simulated failure)
      if (simulateFailureError) {
        item.retries += 1;
        item.lastError = simulateFailureError;

        if (item.retries >= MAX_RETRIES) {
          item.status = "dead_letter";
          queue.deadLetterItems.push(item);
        } else {
          item.status = "failed";
          // Re-enqueue for retry
          queue.items.push(item);
        }
        return null;
      }

      try {
        storeEvent(item.event, storage);
        item.status = "pending"; // completed successfully
        return item.event;
      } catch (err: any) {
        item.retries += 1;
        item.lastError = err?.message || "Storage error";

        if (item.retries >= MAX_RETRIES) {
          item.status = "dead_letter";
          queue.deadLetterItems.push(item);
        } else {
          item.status = "failed";
          queue.items.push(item);
        }
        return null;
      }
    },

    processBatch(batchSize: number): RuntimeEvent[] {
      if (typeof batchSize !== "number" || batchSize <= 0) {
        return [];
      }
      const processed: RuntimeEvent[] = [];
      let count = 0;
      while (count < batchSize && queue.items.length > 0) {
        const item = queue.items[0];
        const event = this.processNext();
        if (event) {
          processed.push(event);
        } else if (item && item.status === "dead_letter") {
          // Dead-lettered item removed from queue.items
        }
        count += 1;
      }
      return processed;
    },

    pendingCount(): number {
      return queue.items ? queue.items.length : 0;
    },

    isEmpty(): boolean {
      return !queue.items || queue.items.length === 0;
    },
  };
}
