// ─── VRF-ONBOARD-003C — Scheduler Invariants Module ───────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { ExperimentSchedule, ScheduleResult } from "./scheduler-types";
import { isExperimentActive } from "./scheduler-engine";
import { validateSchedule } from "./scheduler-validator";

export interface SchedulerInvariantCheckContext {
  experimentDefinition?: ExperimentDefinition;

  schedule?: ExperimentSchedule;

  evaluationTime?: Date;

  scheduleResult?: ScheduleResult;
}

export interface SchedulerInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "warning" | "high" | "critical";

  reason?: string;
}

export interface SchedulerInvariant {
  id: string;

  name: string;

  description: string;

  severity: "warning" | "high" | "critical";

  check: (context: SchedulerInvariantCheckContext) => SchedulerInvariantResult;
}

/**
 * Invariant #84: Scheduler Deterministic. Same input → same output.
 */
export const INV_084_SCHEDULER_DETERMINISTIC: SchedulerInvariant = {
  id: "INV_084_SCHEDULER_DETERMINISTIC",
  name: "Scheduler Evaluation Determinism Guard",
  description: "Executing schedule evaluation on identical inputs must yield identical active status and diagnostics.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_084_SCHEDULER_DETERMINISTIC",
        name: "Scheduler Evaluation Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = isExperimentActive(ctx.experimentDefinition, ctx.evaluationTime);
    const res2 = isExperimentActive(ctx.experimentDefinition, ctx.evaluationTime);

    const passed =
      res1.active === res2.active &&
      res1.matchedChecks.join(",") === res2.matchedChecks.join(",") &&
      res1.failedChecks.join(",") === res2.failedChecks.join(",");

    return {
      passed,
      invariantId: "INV_084_SCHEDULER_DETERMINISTIC",
      name: "Scheduler Evaluation Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Scheduler evaluation produced non-deterministic results across runs.",
    };
  },
};

/**
 * Invariant #85: Start Window Enforced. Experiment cannot activate before startsAt.
 */
export const INV_085_START_WINDOW_ENFORCED: SchedulerInvariant = {
  id: "INV_085_START_WINDOW_ENFORCED",
  name: "Schedule Start Boundary Guard",
  description: "Experiments with startsAt cannot evaluate to active prior to startsAt timestamp.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !schedule.startsAt || !now) {
      return {
        passed: true,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
      };
    }

    const result = ctx.scheduleResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
      };
    }

    if (now.getTime() < schedule.startsAt.getTime()) {
      const passed = result.active === false && result.failedChecks.includes("startsAt");
      return {
        passed,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Experiment evaluated to active before startsAt boundary.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_085_START_WINDOW_ENFORCED",
      name: "Schedule Start Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #86: End Window Enforced. Experiment cannot activate after endsAt.
 */
export const INV_086_END_WINDOW_ENFORCED: SchedulerInvariant = {
  id: "INV_086_END_WINDOW_ENFORCED",
  name: "Schedule Expiration Boundary Guard",
  description: "Experiments with endsAt cannot evaluate to active after endsAt timestamp.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !schedule.endsAt || !now) {
      return {
        passed: true,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
      };
    }

    const result = ctx.scheduleResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
      };
    }

    if (now.getTime() > schedule.endsAt.getTime()) {
      const passed = result.active === false && result.failedChecks.includes("endsAt");
      return {
        passed,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Experiment evaluated to active after endsAt expiration boundary.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_086_END_WINDOW_ENFORCED",
      name: "Schedule Expiration Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #87: Disabled Experiment Blocked. enabled: false always blocks experiment.
 */
export const INV_087_DISABLED_EXPERIMENT_BLOCKED: SchedulerInvariant = {
  id: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
  name: "Disabled Schedule Guard",
  description: "Schedules with enabled: false must evaluate to active: false.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !now) {
      return {
        passed: true,
        invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
        name: "Disabled Schedule Guard",
        severity: "critical",
      };
    }

    if (schedule.enabled === false) {
      const result = ctx.scheduleResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
      if (result) {
        const passed = result.active === false && result.failedChecks.includes("enabled");
        return {
          passed,
          invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
          name: "Disabled Schedule Guard",
          severity: "critical",
          reason: passed ? undefined : "Disabled experiment evaluated to active.",
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
      name: "Disabled Schedule Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #88: Evaluation Order Stable. Checks always execute in order: enabled → startsAt → endsAt.
 */
export const INV_088_EVALUATION_ORDER_STABLE: SchedulerInvariant = {
  id: "INV_088_EVALUATION_ORDER_STABLE",
  name: "Schedule Evaluation Order Stability Guard",
  description: "Schedule checks must strictly execute in order: enabled → startsAt → endsAt.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_088_EVALUATION_ORDER_STABLE",
        name: "Schedule Evaluation Order Stability Guard",
        severity: "critical",
      };
    }

    const result = isExperimentActive(ctx.experimentDefinition, ctx.evaluationTime);
    const combined = [...result.matchedChecks, ...result.failedChecks];

    const EXPECTED_ORDER = ["enabled", "startsAt", "endsAt"];

    let lastIndex = -1;
    let orderValid = true;

    for (const check of combined) {
      const idx = EXPECTED_ORDER.indexOf(check);
      if (idx !== -1) {
        if (idx < lastIndex) {
          orderValid = false;
          break;
        }
        lastIndex = idx;
      }
    }

    return {
      passed: orderValid,
      invariantId: "INV_088_EVALUATION_ORDER_STABLE",
      name: "Schedule Evaluation Order Stability Guard",
      severity: "critical",
      reason: orderValid ? undefined : `Schedule evaluation order violated. Sequence: ${combined.join(" → ")}`,
    };
  },
};

export const SCHEDULER_INVARIANTS: readonly SchedulerInvariant[] = [
  INV_084_SCHEDULER_DETERMINISTIC,
  INV_085_START_WINDOW_ENFORCED,
  INV_086_END_WINDOW_ENFORCED,
  INV_087_DISABLED_EXPERIMENT_BLOCKED,
  INV_088_EVALUATION_ORDER_STABLE,
] as const;

export function checkAllSchedulerInvariants(
  ctx: SchedulerInvariantCheckContext
): SchedulerInvariantResult[] {
  return SCHEDULER_INVARIANTS.map((inv) => inv.check(ctx));
}
