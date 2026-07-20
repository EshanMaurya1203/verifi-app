export interface RevenueSnapshotRow {
  snapshot_date?: string | Date;
  created_at: string | Date;
  total_revenue?: number;
  provider_breakdown?: Record<string, number>;
}

export interface RevenueAnalyticsSnapshot {
  mrr: number;
  arr: number;
  growthPercentage: number;
  history: { date: Date; amount: number }[];
  lastSyncedAt: Date | null;
  hasData: boolean;
  hasMultipleProviders: boolean;
  providerBreakdown: Record<string, number>;
}

/**
 * Revenue Engine
 * 
 * Pure transformer function that assembles pre-fetched revenue data into a
 * raw business facts snapshot.
 * 
 * ZERO database queries. ZERO presentation logic (colors, formatting).
 */
export function buildRevenueSnapshot(
  metrics: { mrr: number; arr: number; growthPercentage: number },
  historyRows: RevenueSnapshotRow[],
  lastSyncedAt: Date | null
): RevenueAnalyticsSnapshot {
  const history = historyRows.map(row => ({
    date: new Date(row.snapshot_date || row.created_at),
    amount: Number(row.total_revenue || 0)
  }));

  const hasData = history.length > 0;

  // History is ordered ascending by `created_at` from `getRevenueHistory`, 
  // so the latest snapshot is at the end of the array.
  const latestSnapshot = hasData ? historyRows[historyRows.length - 1] : null;
  const providerBreakdown: Record<string, number> = latestSnapshot?.provider_breakdown || {};
  
  const hasMultipleProviders = Boolean(providerBreakdown && Object.keys(providerBreakdown).length > 1);

  return {
    mrr: metrics.mrr || 0,
    arr: metrics.arr || 0,
    growthPercentage: metrics.growthPercentage || 0,
    history,
    lastSyncedAt,
    hasData,
    hasMultipleProviders,
    providerBreakdown
  };
}
