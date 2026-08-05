// ─── VRF-ONBOARD-003D / 003D.2 — Governance Audit Module ──────────────────

import type { GovernanceAction } from "./governance-types";
import { GovernanceError } from "./governance-errors";

export interface GovernanceAuditEntry {
  sequence: number;

  actorId: string;

  action: GovernanceAction;

  experimentId: string;

  timestamp: Date;

  /**
   * Optional informational audit reason (e.g. anomaly detection, manual override).
   */
  reason?: string;
}

export interface GovernanceAuditLog {
  entries: readonly GovernanceAuditEntry[];
}

export function createGovernanceAuditLog(): GovernanceAuditLog {
  return Object.freeze({ entries: Object.freeze([]) });
}

/**
 * Appends an entry to the governance audit log.
 * Requires explicit timestamp injection and unique monotonic sequence numbers.
 * Internal current time creation (new Date()) is strictly forbidden.
 */
export function appendGovernanceAudit(
  log: GovernanceAuditLog,
  entry: Omit<GovernanceAuditEntry, "timestamp"> & { timestamp?: Date },
  timestamp?: Date
): GovernanceAuditLog {
  const ts = timestamp || entry.timestamp;

  if (!ts || isNaN(ts.getTime())) {
    throw new GovernanceError("Valid timestamp is required for deterministic governance audit logging.");
  }

  if (
    entry.sequence === undefined ||
    entry.sequence === null ||
    typeof entry.sequence !== "number" ||
    !Number.isInteger(entry.sequence) ||
    entry.sequence < 0
  ) {
    throw new GovernanceError("Valid sequence number (integer >= 0) is required for audit logging.");
  }

  if (!log || !Array.isArray(log.entries)) {
    log = createGovernanceAuditLog();
  }

  // Check sequence uniqueness and monotonicity
  for (const existing of log.entries) {
    if (existing.sequence === entry.sequence) {
      throw new GovernanceError(`Duplicate audit sequence number ${entry.sequence} rejected.`);
    }
  }

  if (log.entries.length > 0) {
    const lastSeq = log.entries[log.entries.length - 1].sequence;
    if (entry.sequence <= lastSeq) {
      throw new GovernanceError(`Audit sequence ${entry.sequence} must be strictly monotonic (greater than ${lastSeq}).`);
    }
  }

  const frozenEntry: GovernanceAuditEntry = Object.freeze({
    sequence: entry.sequence,
    actorId: entry.actorId,
    action: entry.action,
    experimentId: entry.experimentId,
    timestamp: new Date(ts.getTime()),
    reason: entry.reason ? String(entry.reason) : undefined,
  });

  return Object.freeze({
    entries: Object.freeze([...log.entries, frozenEntry]),
  });
}

/**
 * Returns audit history sorted deterministically by PRIMARY: sequence (ascending), SECONDARY: timestamp (ascending).
 */
export function getGovernanceAuditHistory(
  log: GovernanceAuditLog,
  experimentId?: string
): readonly GovernanceAuditEntry[] {
  if (!log || !Array.isArray(log.entries)) {
    return Object.freeze([]);
  }

  let filtered = experimentId ? log.entries.filter((e) => e.experimentId === experimentId) : [...log.entries];

  // Deterministic sorting: PRIMARY: sequence, SECONDARY: timestamp
  filtered.sort((a, b) => {
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  return Object.freeze(filtered);
}
