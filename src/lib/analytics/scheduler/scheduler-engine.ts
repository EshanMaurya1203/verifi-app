// ─── VRF-ONBOARD-003C / 003C.1 — Scheduler Engine Module ───────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { ScheduleResult } from "./scheduler-types";
import { validateSchedule } from "./scheduler-validator";
import { ScheduleEvaluationError } from "./scheduler-errors";

/**
 * Evaluation Strategy:
 *
 * - Full evaluation
 * - No fail-fast behavior
 * - Collect all failures
 * - Deterministic rule order
 * - Strict time injection (now: Date is REQUIRED; no internal current time creation)
 *
 * Empty Window Semantics:
 * { enabled: true } without startsAt and endsAt means "always active".
 * { enabled: false } without startsAt and endsAt means "inactive".
 *
 * Complexity:
 *
 * O(number_of_checks)
 *
 * Current checks:
 *
 * 1. enabled
 * 2. startsAt
 * 3. endsAt
 */
export function isExperimentActive(
  experiment: ExperimentDefinition,
  now: Date
): ScheduleResult {
  if (!experiment) {
    throw new ScheduleEvaluationError("Experiment definition is required for schedule evaluation.");
  }
  if (!now || isNaN(now.getTime())) {
    throw new ScheduleEvaluationError("Valid evaluation timestamp (now) is required for deterministic schedule evaluation.");
  }

  const schedule = experiment.schedule || { enabled: true };
  const validation = validateSchedule(schedule);
  if (!validation.passed) {
    throw new ScheduleEvaluationError(`Invalid experiment schedule: ${validation.errors.join("; ")}`);
  }

  const matchedChecks: string[] = [];
  const failedChecks: string[] = [];
  const failureReasons: string[] = [];

  // 1. Enabled check
  if (schedule.enabled === true) {
    matchedChecks.push("enabled");
  } else {
    failedChecks.push("enabled");
    failureReasons.push("Experiment disabled");
  }

  // 2. StartsAt check
  if (schedule.startsAt && now.getTime() < schedule.startsAt.getTime()) {
    failedChecks.push("startsAt");
    failureReasons.push("Experiment has not started");
  } else {
    matchedChecks.push("startsAt");
  }

  // 3. EndsAt check
  if (schedule.endsAt && now.getTime() > schedule.endsAt.getTime()) {
    failedChecks.push("endsAt");
    failureReasons.push("Experiment has expired");
  } else {
    matchedChecks.push("endsAt");
  }

  const active = failedChecks.length === 0;
  const reason = active ? undefined : failureReasons.join("; ");

  return {
    active,
    reason,
    matchedChecks,
    failedChecks,
  };
}
