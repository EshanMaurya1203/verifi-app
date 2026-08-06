// ─── VRF-ONBOARD-004D — Metrics Utils ────────────────────────────────────────

/**
 * Builds a deterministic MetricsSnapshot ID.
 * Format: `${experimentId}:${generatedAt.toISOString()}`
 */
export function buildMetricsSnapshotId(experimentId: string, generatedAt: Date): string {
  const cleanExpId = experimentId.trim();
  const cleanDate = generatedAt.toISOString();
  return `${cleanExpId}:${cleanDate}`;
}

/**
 * Safely computes conversion rate (conversions / exposures).
 * Rules:
 * 1. if exposures === 0, returns 0.
 * 2. Never returns NaN, Infinity, -Infinity, or -0.
 */
export function computeSafeConversionRate(conversions: number, exposures: number): number {
  if (exposures <= 0 || !isFinite(exposures)) {
    return 0;
  }
  if (conversions <= 0 || !isFinite(conversions)) {
    return 0;
  }
  const rate = conversions / exposures;
  if (!isFinite(rate) || isNaN(rate)) {
    return 0;
  }
  return Object.is(rate, -0) ? 0 : rate;
}
