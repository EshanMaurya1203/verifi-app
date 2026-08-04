// ─── VRF-ONBOARD-001E.12H — Dashboard Performance Metrics ───────────────

import type { DashboardState, PerformanceMetrics } from "./experiments";

/**
 * Measures performance metrics for a dashboard render / calculation pass.
 */
export function measureDashboardPerformance(
  dashboard: DashboardState,
  renderTimeMs: number,
  cacheHit: boolean
): PerformanceMetrics {
  return {
    experimentCount: dashboard?.cards?.length || 0,
    alertCount: dashboard?.alerts?.length || 0,
    renderTimeMs: Math.max(0, renderTimeMs),
    cacheHit,
  };
}
