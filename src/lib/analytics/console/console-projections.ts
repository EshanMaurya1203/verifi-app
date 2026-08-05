// ─── VRF-ONBOARD-003E / 003E.1 — Console Projections ───────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { TargetingContext } from "../targeting/targeting-context";
import { isEligible } from "../targeting/targeting-engine";
import { isExperimentActive } from "../scheduler/scheduler-engine";
import type { GovernanceActor, GovernanceAction } from "../governance/governance-types";
import { canPerformAction } from "../governance/governance-engine";
import type { GovernanceAuditLog } from "../governance/governance-audit";
import { getGovernanceAuditHistory } from "../governance/governance-audit";
import { ProjectionError } from "./console-errors";
import type {
  VariantConsoleView,
  TargetingConsoleView,
  ScheduleConsoleView,
  GovernanceConsoleView,
  AuditConsoleView,
  ExperimentConsoleView,
} from "./console-types";

const ALL_GOVERNANCE_ACTIONS: readonly GovernanceAction[] = [
  "create",
  "edit",
  "request_review",
  "review",
  "approve",
  "activate",
  "pause",
  "archive",
] as const;

/**
 * Projects experiment variants to console view.
 */
export function projectVariants(experiment: ExperimentDefinition): readonly VariantConsoleView[] {
  if (!experiment || !Array.isArray(experiment.variants)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    experiment.variants.map((v) =>
      Object.freeze({
        id: v.id,
        name: v.name,
        weight: v.weight,
      })
    )
  );
}

/**
 * Projects targeting evaluation to console view.
 */
export function projectTargeting(
  experiment: ExperimentDefinition,
  targetingContext?: TargetingContext
): TargetingConsoleView {
  if (!experiment) {
    throw new ProjectionError("ExperimentDefinition is required for targeting projection.");
  }

  if (!targetingContext) {
    return Object.freeze({
      eligible: false,
      matchedRules: Object.freeze([]),
      failedRules: Object.freeze(["missing_targeting_context"]),
    });
  }

  const result = isEligible(experiment, targetingContext);
  return Object.freeze({
    eligible: result.eligible,
    matchedRules: Object.freeze([...result.matchedRules]),
    failedRules: Object.freeze([...result.failedRules]),
  });
}

/**
 * Projects schedule evaluation to console view.
 */
export function projectSchedule(
  experiment: ExperimentDefinition,
  now: Date
): ScheduleConsoleView {
  if (!experiment) {
    throw new ProjectionError("ExperimentDefinition is required for schedule projection.");
  }
  if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
    throw new ProjectionError("Valid Date 'now' is required for schedule projection.");
  }

  const result = isExperimentActive(experiment, now);
  return Object.freeze({
    active: result.active,
    matchedChecks: Object.freeze([...result.matchedChecks]),
    failedChecks: Object.freeze([...result.failedChecks]),
  });
}

/**
 * Projects governance permissions and allowed actions for the actor to console view.
 */
export function projectGovernance(
  experiment: ExperimentDefinition,
  actor: GovernanceActor
): GovernanceConsoleView {
  if (!experiment) {
    throw new ProjectionError("ExperimentDefinition is required for governance projection.");
  }
  if (!actor) {
    throw new ProjectionError("GovernanceActor is required for governance projection.");
  }

  const allowedActions: string[] = [];
  for (const action of ALL_GOVERNANCE_ACTIONS) {
    const decision = canPerformAction(actor, action, experiment);
    if (decision.allowed) {
      allowedActions.push(action);
    }
  }

  return Object.freeze({
    allowedActions: Object.freeze(allowedActions),
  });
}

/**
 * Projects audit history sorted by sequence and timestamp to console view.
 */
export function projectAudit(
  auditLog?: GovernanceAuditLog,
  experimentId?: string
): readonly AuditConsoleView[] {
  if (!auditLog) {
    return Object.freeze([]);
  }

  const history = getGovernanceAuditHistory(auditLog, experimentId);
  return Object.freeze(
    history.map((e) =>
      Object.freeze({
        sequence: e.sequence,
        actorId: e.actorId,
        action: e.action,
        timestamp: new Date(e.timestamp.getTime()),
        reason: e.reason,
      })
    )
  );
}

/**
 * Projects a complete read-only ExperimentConsoleView projection.
 * Requires explicit timestamp injection ('now'). No internal 'new Date()' is instantiated.
 */
export function projectExperiment(
  experiment: ExperimentDefinition,
  actor: GovernanceActor,
  targetingContext: TargetingContext | undefined,
  now: Date,
  auditLog?: GovernanceAuditLog
): ExperimentConsoleView {
  if (!experiment) {
    throw new ProjectionError("ExperimentDefinition is required for experiment projection.");
  }
  if (!actor) {
    throw new ProjectionError("GovernanceActor is required for experiment projection.");
  }
  if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
    throw new ProjectionError("Valid Date 'now' is required for experiment projection.");
  }

  const variants = projectVariants(experiment);
  const targeting = projectTargeting(experiment, targetingContext);
  const schedule = projectSchedule(experiment, now);
  const governance = projectGovernance(experiment, actor);
  const audit = projectAudit(auditLog, experiment.id);

  return Object.freeze({
    projectionVersion: 1,
    generatedAt: new Date(now.getTime()),
    experimentId: experiment.id,
    name: experiment.name,
    ownerId: experiment.ownerId,
    status: experiment.status,
    version: experiment.version,
    createdAt: new Date(experiment.createdAt.getTime()),
    updatedAt: new Date(experiment.updatedAt.getTime()),
    variants,
    targeting,
    schedule,
    governance,
    audit,
  });
}
