// ─── VRF-ONBOARD-001E.12H — Analytics Export Engine ─────────────────────

import type {
  DashboardState,
  ExportMetadata,
  ExportResult,
} from "./experiments";

/**
 * Exports DashboardState into a formatted JSON string with metadata.
 *
 * Rules:
 * - Valid JSON
 * - Pretty-printed (2 spaces)
 * - Includes metadata (exportedAt, format: "json", experimentCount)
 */
export function exportToJson(
  dashboard: DashboardState
): ExportResult {
  if (!dashboard) {
    throw new Error("DashboardState is required for JSON export.");
  }

  const cards = dashboard.cards || [];
  const metadata: ExportMetadata = {
    exportedAt: new Date(),
    format: "json",
    experimentCount: cards.length,
  };

  const exportPayload = {
    metadata,
    summary: dashboard.summary,
    cards: dashboard.cards,
    alerts: dashboard.alerts,
  };

  const content = JSON.stringify(exportPayload, null, 2);

  return {
    metadata,
    content,
  };
}

/**
 * Exports DashboardState into a CSV formatted string.
 *
 * Columns:
 * experimentId,experimentName,status,confidenceScore,confidenceLevel,regressionSeverity,rollbackRecommendation,safeToContinue
 *
 * Rules:
 * - First line is header
 * - One row per experiment card
 */
export function exportToCsv(
  dashboard: DashboardState
): ExportResult {
  if (!dashboard) {
    throw new Error("DashboardState is required for CSV export.");
  }

  const cards = dashboard.cards || [];
  const metadata: ExportMetadata = {
    exportedAt: new Date(),
    format: "csv",
    experimentCount: cards.length,
  };

  const header = [
    "experimentId",
    "experimentName",
    "status",
    "confidenceScore",
    "confidenceLevel",
    "regressionSeverity",
    "rollbackRecommendation",
    "safeToContinue",
  ].join(",");

  const rows = cards.map((c) => {
    // Sanitize string values if needed (quote if comma present)
    const name = c.experimentName.includes(",") ? `"${c.experimentName}"` : c.experimentName;
    return [
      c.experimentId,
      name,
      c.status,
      c.confidenceScore,
      c.confidenceLevel,
      c.regressionSeverity,
      c.rollbackRecommendation,
      c.safeToContinue,
    ].join(",");
  });

  const content = [header, ...rows].join("\n");

  return {
    metadata,
    content,
  };
}
