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
// ─── VRF-ONBOARD-004E — Statistics Utils ──────────────────────────────────────

/**
 * Computes conversion rate p = conversions / exposures safely.
 * Returns 0 if exposures === 0 or if inputs/outputs are non-finite.
 */
export function computeConversionRate(conversions: number, exposures: number): number {
  if (exposures <= 0 || !isFinite(exposures)) return 0;
  if (conversions <= 0 || !isFinite(conversions)) return 0;
  const rate = conversions / exposures;
  if (!isFinite(rate) || isNaN(rate)) return 0;
  const rounded = Math.round(rate * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes relative lift = (candidateRate - baselineRate) / baselineRate.
 * Returns 0 if baselineRate === 0.
 */
export function computeLift(candidateRate: number, baselineRate: number): number {
  if (baselineRate === 0 || !isFinite(baselineRate)) return 0;
  if (!isFinite(candidateRate)) return 0;
  const lift = (candidateRate - baselineRate) / baselineRate;
  if (!isFinite(lift) || isNaN(lift)) return 0;
  const rounded = Math.round(lift * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes standard error SE = sqrt((p * (1 - p)) / n).
 */
export function computeStandardError(conversions: number, exposures: number): number {
  if (exposures <= 0 || !isFinite(exposures)) return 0;
  const p = computeConversionRate(conversions, exposures);
  const se = Math.sqrt((p * (1 - p)) / exposures);
  if (!isFinite(se) || isNaN(se)) return 0;
  const rounded = Math.round(se * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes pooled probability p_pool = (c1 + c2) / (n1 + n2).
 */
export function computePooledProbability(
  c1: number,
  n1: number,
  c2: number,
  n2: number
): number {
  const totalN = n1 + n2;
  if (totalN <= 0 || !isFinite(totalN)) return 0;
  const totalC = c1 + c2;
  const pool = totalC / totalN;
  if (!isFinite(pool) || isNaN(pool)) return 0;
  const rounded = Math.round(pool * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes Z-score z = (p2 - p1) / sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2)).
 * Guarantees a finite number output (never NaN, Infinity, -Infinity, or -0).
 */
export function computeZScore(
  c1: number,
  n1: number,
  c2: number,
  n2: number
): number {
  if (n1 <= 0 || n2 <= 0 || !isFinite(n1) || !isFinite(n2)) return 0;
  const p1 = computeConversionRate(c1, n1);
  const p2 = computeConversionRate(c2, n2);
  const pPool = computePooledProbability(c1, n1, c2, n2);

  if (pPool <= 0 || pPool >= 1) return 0;

  const sePooled = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (sePooled === 0 || !isFinite(sePooled)) return 0;

  const z = (p2 - p1) / sePooled;
  if (!isFinite(z) || isNaN(z)) return 0;
  const rounded = Math.round(z * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Standard Normal Cumulative Distribution Function (CDF) using Abramowitz and Stegun 7.1.26.
 * Output bounded strictly between 0 and 1.
 */
export function cdfNormal(x: number): number {
  if (!isFinite(x) || isNaN(x)) return 0.5;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * absX);
  const d = 0.3989422804014327; // 1 / Math.sqrt(2 * Math.PI)
  const prob =
    d *
    Math.exp((-absX * absX) / 2) *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = x >= 0 ? 1 - prob : prob;
  return Math.max(0, Math.min(1, cdf));
}

/**
 * Computes two-tailed p-value for a Z-score.
 * Rules:
 * 1. 0 <= pValue <= 1.
 * 2. Never returns NaN, Infinity, -Infinity, or -0.
 */
export function computePValue(zScore: number): number {
  if (zScore === 0 || !isFinite(zScore) || isNaN(zScore)) return 1.0;
  const p = 2 * (1 - cdfNormal(Math.abs(zScore)));
  if (!isFinite(p) || isNaN(p)) return 1.0;
  const boundedP = Math.max(0, Math.min(1, p));
  const rounded = Math.round(boundedP * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}
