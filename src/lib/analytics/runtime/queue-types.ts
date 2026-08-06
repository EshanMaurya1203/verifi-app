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
// ─── VRF-ONBOARD-002Y — Queue Failure Semantics Domain Types ────────────

import type { RuntimeEvent } from "./runtime-types";

export const MAX_RETRIES = 3;

export interface QueuedEvent {
  event: RuntimeEvent;

  retries: number;

  lastError?: string;

  status: "pending" | "processing" | "failed" | "dead_letter";
}
