// ─── VRF-ONBOARD-003C — Scheduler Normalization Module ───────────────────

/**
 * Normalizes a timezone string by trimming whitespace and collapsing interior spaces.
 * Returns undefined for empty, null, undefined, or whitespace-only inputs.
 *
 * Examples:
 * " UTC " → "UTC"
 * " Asia/Kolkata " → "Asia/Kolkata"
 * " " → undefined
 */
export function normalizeTimezone(timezone?: string): string | undefined {
  if (typeof timezone !== "string") {
    return undefined;
  }
  const trimmed = timezone.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}
