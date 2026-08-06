// ─── VRF-ONBOARD-005D — Experiment Scheduler Projections Module ─────────────

import type { StageSchedule, ScheduleHistoryEntry, SchedulePlan, ScheduleResult } from "./scheduler-types";

/**
 * Projects a deeply frozen StageSchedule.
 */
export function projectStageSchedule(stage: StageSchedule): Readonly<StageSchedule> {
  return Object.freeze({
    stageNumber: stage.stageNumber,
    trafficPercentage: stage.trafficPercentage,
    startsAtTick: stage.startsAtTick,
    endsAtTick: stage.endsAtTick,
  });
}

/**
 * Projects a deeply frozen ScheduleHistoryEntry.
 */
export function projectScheduleHistoryEntry(entry: ScheduleHistoryEntry): Readonly<ScheduleHistoryEntry> {
  return Object.freeze({
    sequence: entry.sequence,
    stageNumber: entry.stageNumber,
    startsAtTick: entry.startsAtTick,
    endsAtTick: entry.endsAtTick,
  });
}

/**
 * Projects a deeply frozen SchedulePlan.
 */
export function projectSchedulePlan(plan: SchedulePlan): Readonly<SchedulePlan> {
  return Object.freeze({
    experimentId: plan.experimentId,
    currentStage: plan.currentStage,
    stages: Object.freeze(plan.stages.map(projectStageSchedule)),
    history: Object.freeze(plan.history.map(projectScheduleHistoryEntry)),
    expiresAtTick: plan.expiresAtTick,
    autoPauseOnExpiration: plan.autoPauseOnExpiration,
  });
}

/**
 * Projects a deeply frozen ScheduleResult.
 */
export function projectScheduleResult(res: ScheduleResult): Readonly<ScheduleResult> {
  return Object.freeze({
    plan: projectSchedulePlan(res.plan),
  });
}
