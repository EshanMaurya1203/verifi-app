// ─── VRF-ONBOARD-004D — Metrics Domain Types ─────────────────────────────────

export interface VariantMetrics {
  experimentId: string;
  variantId: string;
  exposures: number;
  uniqueExposures: number;
  conversions: number;
  uniqueConversions: number;
  conversionRate: number;
}

export interface ExperimentMetrics {
  experimentId: string;
  variants: readonly VariantMetrics[];
  totalExposures: number;
  totalConversions: number;
  overallConversionRate: number;
}

export interface MetricsSnapshot {
  snapshotId: string;
  experimentId: string;
  generatedAt: Date;
  metrics: ExperimentMetrics;
}

export interface MetricsResult {
  snapshot: MetricsSnapshot;
}
