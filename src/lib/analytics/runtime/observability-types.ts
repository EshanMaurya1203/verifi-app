// ─── VRF-ONBOARD-002E / 002X — Observability Domain Types ────────────────

import type { AuditEntry } from "./audit-log";

export interface ExperimentMetrics {
  experimentId: string;

  assignments: number;

  variantExposed: number;

  variantRendered: number;

  variantSeen: number;

  conversions: number;

  failures: number;
}

export interface ExperimentHealth {
  experimentId: string;

  status: "healthy" | "warning" | "critical";

  score: number;
}

export interface ObservabilitySnapshot {
  generatedAt: Date;

  metrics: ExperimentMetrics[];

  health: ExperimentHealth[];

  auditEntries: AuditEntry[];
}
