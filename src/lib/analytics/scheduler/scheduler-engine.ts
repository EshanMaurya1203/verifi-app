// ─── VRF-ONBOARD-003C & 005D — Experiment Scheduler Module ──────────────────

import { SchedulerValidationError, ScheduleEvaluationError } from "./scheduler-errors";
import type { ExecutionReport } from "../execution/execution-types";
import type {
  ExperimentSchedule,
  ScheduleEvaluationResult,
  LogicalClock,
  SchedulingPolicy,
  ScheduleHistoryEntry,
  SchedulePlan,
  ScheduleResult,
} from "./scheduler-types";
import { DEFAULT_SCHEDULING_POLICY, generateStageSchedules, buildScheduleHistoryEntry } from "./scheduler-utils";
import { validateScheduleRequest } from "./scheduler-validator";

// ─── 003C Legacy Schedule Active Check ───────────────────────────────────────
export function isExperimentActive(
  experiment: { schedule?: ExperimentSchedule; status?: string },
  now: Date
): ScheduleEvaluationResult {
  if (!experiment) {
    throw new ScheduleEvaluationError("ExperimentDefinition is required for schedule evaluation.");
  }
  if (!now || !(now instanceof Date) || isNaN(now.getTime())) {
    throw new ScheduleEvaluationError("Valid Date 'now' is required for schedule evaluation.");
  }

  const matched: string[] = [];
  const failed: string[] = [];
  const sched = experiment.schedule;

  if (!sched || !sched.enabled) {
    failed.push("enabled");
    return Object.freeze({
      active: false,
      reason: "Experiment disabled",
      matchedChecks: Object.freeze(matched),
      failedChecks: Object.freeze(failed),
    });
  }
  matched.push("enabled");

  const nowMs = now.getTime();

  if (sched.startsAt || sched.startDate) {
    const sVal = sched.startsAt || sched.startDate;
    const startMs = new Date(sVal!).getTime();
    if (nowMs < startMs) {
      failed.push("startsAt");
    } else {
      matched.push("startsAt");
    }
  }

  if (sched.endsAt || sched.endDate) {
    const eVal = sched.endsAt || sched.endDate;
    const endMs = new Date(eVal!).getTime();
    if (nowMs > endMs) {
      failed.push("endsAt");
    } else {
      matched.push("endsAt");
    }
  }

  const active = failed.length === 0;
  let reason: string | undefined = undefined;
  if (!active) {
    if (failed.includes("startsAt")) {
      reason = "Experiment has not started";
    } else if (failed.includes("endsAt")) {
      reason = "Experiment has expired";
    } else {
      reason = "Experiment disabled";
    }
  }

  return Object.freeze({
    active,
    reason,
    matchedChecks: Object.freeze(matched),
    failedChecks: Object.freeze(failed),
  });
}

// ─── 005D Logical Time Scheduler Engine ──────────────────────────────────────

/**
 * Deterministically generates a SchedulePlan based on an ExecutionReport, LogicalClock, and SchedulingPolicy.
 *
 * LOGICAL TIME CONSTRAINTS:
 * 1. Prohibits Date.now(), new Date(), calendars, UTC, local clocks, or time zones.
 * 2. Operates strictly on deterministic integer logical ticks.
 * 3. Guarantees non-overlapping stage windows and append-only history.
 *
 * Rules:
 * - Rule 1: Stage 1 startsAtTick = clock.currentTick
 * - Rule 2: Stage N startsAtTick = Stage (N-1).endsAtTick + cooldownTicks
 * - Rule 3: endsAtTick = startsAtTick + stageDurationTicks
 * - Rule 4: expiresAtTick = max(clock.currentTick + expirationTicks, lastStage.endsAtTick + 1)
 * - Rule 5: Non-overlapping windows
 * - Rule 6: History is append-only
 * - Rule 7: currentStage == last(history).stageNumber (when history non-empty)
 */
export function buildSchedule(
  executionReport: ExecutionReport,
  previousHistory: readonly ScheduleHistoryEntry[] = [],
  clock: LogicalClock,
  policy?: Partial<SchedulingPolicy>
): ScheduleResult {
  const validation = validateScheduleRequest(executionReport, previousHistory, clock, policy);
  if (!validation.passed) {
    throw new SchedulerValidationError(
      `Invalid schedule request: ${validation.errors.join("; ")}`
    );
  }

  const effectivePolicy: SchedulingPolicy = {
    stageDurationTicks: policy?.stageDurationTicks ?? DEFAULT_SCHEDULING_POLICY.stageDurationTicks,
    cooldownTicks: policy?.cooldownTicks ?? DEFAULT_SCHEDULING_POLICY.cooldownTicks,
    expirationTicks: policy?.expirationTicks ?? DEFAULT_SCHEDULING_POLICY.expirationTicks,
    autoPauseOnExpiration: policy?.autoPauseOnExpiration ?? DEFAULT_SCHEDULING_POLICY.autoPauseOnExpiration,
  };

  const stages = generateStageSchedules(executionReport, clock.currentTick, effectivePolicy);

  const lastStageEnd = stages.length > 0 ? stages[stages.length - 1].endsAtTick : clock.currentTick;
  const expiresAtTick = Math.max(clock.currentTick + effectivePolicy.expirationTicks, lastStageEnd + 1);

  const currentStage = executionReport.currentStage;
  const nextSeq = previousHistory.length > 0 ? previousHistory[previousHistory.length - 1].sequence + 1 : 1;

  let newHistory: readonly ScheduleHistoryEntry[] = Object.freeze([...previousHistory]);

  if (currentStage > 0) {
    const hasCurrent = previousHistory.length > 0 && previousHistory[previousHistory.length - 1].stageNumber === currentStage;
    if (!hasCurrent) {
      const matchingStage = stages.find((s) => s.stageNumber === currentStage);
      if (matchingStage) {
        const entry = buildScheduleHistoryEntry(
          nextSeq,
          currentStage,
          matchingStage.startsAtTick,
          matchingStage.endsAtTick
        );
        newHistory = Object.freeze([...previousHistory, entry]);
      }
    }
  }

  const plan: SchedulePlan = Object.freeze({
    experimentId: executionReport.experimentId.trim(),
    currentStage,
    stages,
    history: newHistory,
    expiresAtTick,
    autoPauseOnExpiration: effectivePolicy.autoPauseOnExpiration,
  });

  return Object.freeze({
    plan,
  });
}
