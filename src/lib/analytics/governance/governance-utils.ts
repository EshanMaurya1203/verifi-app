// ─── VRF-ONBOARD-003D / 003D.1 — Governance Utilities Module ──────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceActor } from "./governance-types";

/**
 * Pure predicate checking whether a governance actor owns an experiment.
 * Supports both legacy experiment.owner and experiment.ownerId fields.
 *
 * IMPORTANT: All ownership checks MUST route through isOwner()
 * to prepare for future organization, team, and delegated ownership models.
 */
export function isOwner(
  actor: GovernanceActor,
  experiment: ExperimentDefinition
): boolean {
  if (!actor || !actor.id || !experiment) {
    return false;
  }
  const actorId = actor.id.trim();
  const owner = experiment.owner ? experiment.owner.trim() : undefined;
  const ownerId = experiment.ownerId ? experiment.ownerId.trim() : undefined;

  return (ownerId !== undefined && actorId === ownerId) || (owner !== undefined && actorId === owner);
}
