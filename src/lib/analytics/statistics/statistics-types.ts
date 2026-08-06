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
// ─── VRF-ONBOARD-004E — Statistics Domain Types ──────────────────────────────

export interface VariantStatistics {
  experimentId: string;
  variantId: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  standardError: number;
}

export interface SignificanceReport {
  experimentId: string;
  baselineVariantId: string;
  candidateVariantId: string;
  baselineRate: number;
  candidateRate: number;
  lift: number;
  zScore: number;
  pValue: number;
  confidenceLevel: number;
  statisticallySignificant: boolean;
}

export interface StatisticsResult {
  report: SignificanceReport;
}
