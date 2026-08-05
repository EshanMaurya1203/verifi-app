// ─── VRF-ONBOARD-003E / 003E.2 — Console Utils ─────────────────────────────

import type { ExperimentConsoleView } from "./console-types";

/**
 * Creates a structural, read-only snapshot copy of an ExperimentConsoleView projection.
 * Immutability is preserved across all nested objects.
 * Cloning semantics are forbidden for immutable projections.
 */
export function snapshotConsoleView(view: ExperimentConsoleView): ExperimentConsoleView {
  if (!view) {
    throw new Error("Console view is required for snapshotting.");
  }

  return Object.freeze({
    projectionVersion: 1,
    generatedAt: new Date(view.generatedAt.getTime()),
    experimentId: view.experimentId,
    name: view.name,
    ownerId: view.ownerId,
    status: view.status,
    version: view.version,
    createdAt: new Date(view.createdAt.getTime()),
    updatedAt: new Date(view.updatedAt.getTime()),
    variants: Object.freeze(view.variants.map((v) => Object.freeze({ ...v }))),
    targeting: Object.freeze({
      eligible: view.targeting.eligible,
      matchedRules: Object.freeze([...view.targeting.matchedRules]),
      failedRules: Object.freeze([...view.targeting.failedRules]),
    }),
    schedule: Object.freeze({
      active: view.schedule.active,
      matchedChecks: Object.freeze([...view.schedule.matchedChecks]),
      failedChecks: Object.freeze([...view.schedule.failedChecks]),
    }),
    governance: Object.freeze({
      allowedActions: Object.freeze([...view.governance.allowedActions]),
    }),
    audit: Object.freeze(
      view.audit.map((a) =>
        Object.freeze({
          sequence: a.sequence,
          actorId: a.actorId,
          action: a.action,
          timestamp: new Date(a.timestamp.getTime()),
          reason: a.reason,
        })
      )
    ),
  });
}
