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
// ─── VRF-ONBOARD-002E — Audit Trail Explorer Module ────────────────────

import type { AuditEntry, AuditLog } from "./audit-log";
import { getAuditTrail } from "./audit-log";

/**
 * Retrieves all audit entries for a specific experiment, newest first.
 */
export function getAuditEntriesByExperiment(
  experimentId: string,
  audit: AuditLog
): AuditEntry[] {
  if (!experimentId || !audit || !audit.entries) {
    return [];
  }
  return getAuditTrail(audit).filter((e) => e.experimentId === experimentId);
}

/**
 * Retrieves all audit entries for a specific audit action, newest first.
 */
export function getAuditEntriesByAction(
  action: AuditEntry["action"],
  audit: AuditLog
): AuditEntry[] {
  if (!action || !audit || !audit.entries) {
    return [];
  }
  return getAuditTrail(audit).filter((e) => e.action === action);
}

/**
 * Retrieves the N most recent audit entries, newest first.
 */
export function getRecentAuditEntries(
  limit: number,
  audit: AuditLog
): AuditEntry[] {
  if (!audit || !audit.entries) {
    return [];
  }
  const trail = getAuditTrail(audit);
  return trail.slice(0, Math.max(0, limit));
}
