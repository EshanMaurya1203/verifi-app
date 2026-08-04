import { MAX_STEP_DURATION_MS } from "./diagnostics-config";

/**
 * Normalizes a step transition duration in milliseconds.
 * Returns null if the transition exceeds MAX_STEP_DURATION_MS (2 hours) or is negative/invalid.
 * This prevents multi-day user idle periods from distorting step duration metrics.
 */
export function normalizeStepDuration(durationMs: number): number | null {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_STEP_DURATION_MS) {
    return null;
  }
  return durationMs;
}
