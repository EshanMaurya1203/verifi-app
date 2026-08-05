// ─── VRF-ONBOARD-003B.2 — Targeting Context Utilities Module ──────────────

/**
 * Checks whether a context field value is considered missing or empty.
 *
 * Rules:
 * Return true for:
 * ✓ undefined
 * ✓ null
 * ✓ ""
 * ✓ " "
 * ✓ "     "
 *
 * Return false for non-empty strings (e.g. "IN", "stripe", "google", "step_1").
 */
export function isMissingContextValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}
