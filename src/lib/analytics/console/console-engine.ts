// ─── VRF-ONBOARD-003E — Console Engine ────────────────────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceActor } from "../governance/governance-types";
import type { TargetingContext } from "../targeting/targeting-context";
import type { GovernanceAuditLog } from "../governance/governance-audit";
import type { ExperimentConsoleView } from "./console-types";
import { projectExperiment } from "./console-projections";
import { ProjectionError } from "./console-errors";

/**
 * Builds a deterministic, immutable ExperimentConsoleView projection.
 *
 * Constraints:
 * ✓ Read-only projection layer only
 * ✓ NO business logic
 * ✓ NO targeting evaluation logic
 * ✓ NO schedule mutation
 * ✓ NO state transitions
 */
export function buildExperimentConsoleView(
  experiment: ExperimentDefinition,
  actor: GovernanceActor,
  targetingContext: TargetingContext | undefined,
  now: Date,
  auditLog?: GovernanceAuditLog
): ExperimentConsoleView {
  if (!experiment) {
    throw new ProjectionError("ExperimentDefinition is required for console view generation.");
  }
  if (!actor) {
    throw new ProjectionError("GovernanceActor is required for console view generation.");
  }
  if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
    throw new ProjectionError("Valid Date 'now' parameter is required for console view generation.");
  }

  return projectExperiment(experiment, actor, targetingContext, now, auditLog);
}
