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
// ─── VRF-ONBOARD-002D / 002X — Audit Logging & Retention Engine ─────────

import type { RuntimeFlags } from "./feature-flags";

export const MAX_AUDIT_ENTRIES = 10000;

export interface AuditEntry {
  timestamp: Date;

  userId?: string;

  experimentId: string;

  action:
    | "kill_switch_triggered"
    | "experiment_paused"
    | "force_control"
    | "forced_variant";

  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  entries: AuditEntry[];
}

/**
 * Creates an empty in-memory AuditLog.
 */
export function createAuditLog(): AuditLog {
  return {
    entries: [],
  };
}

/**
 * Records an audit entry into the audit log, enforcing MAX_AUDIT_ENTRIES retention.
 *
 * Rules:
 * - Retains newest entries
 * - Evicts oldest entries when total count exceeds MAX_AUDIT_ENTRIES (10,000)
 * - Preserves insertion order
 */
export function recordAudit(
  audit: AuditLog,
  entry: AuditEntry
): void {
  if (!audit || !audit.entries) {
    return;
  }

  audit.entries.push(entry);

  if (audit.entries.length > MAX_AUDIT_ENTRIES) {
    audit.entries = audit.entries.slice(audit.entries.length - MAX_AUDIT_ENTRIES);
  }
}

/**
 * Returns all audit entries, newest first.
 */
export function getAuditTrail(audit: AuditLog): AuditEntry[] {
  if (!audit || !audit.entries) {
    return [];
  }
  return [...audit.entries].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

/**
 * Triggers an emergency rollback for a specific experiment.
 */
export function triggerEmergencyRollback(
  experimentId: string,
  flags: RuntimeFlags,
  audit: AuditLog
): void {
  flags.pausedExperiments.add(experimentId);

  recordAudit(audit, {
    timestamp: new Date(),
    experimentId,
    action: "experiment_paused",
    metadata: {
      trigger: "emergency_rollback",
      rolledBackAt: new Date().toISOString(),
    },
  });
}
