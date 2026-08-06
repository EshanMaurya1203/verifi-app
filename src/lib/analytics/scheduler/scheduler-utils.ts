// ─── VRF-ONBOARD-005D — Experiment Scheduler Utils ───────────────────────────

import type { ExecutionReport } from "../execution/execution-types";
import type { SchedulingPolicy, StageSchedule, ScheduleHistoryEntry } from "./scheduler-types";

export const DEFAULT_SCHEDULING_POLICY: Readonly<SchedulingPolicy> = Object.freeze({
  stageDurationTicks: 24,
  cooldownTicks: 6,
  expirationTicks: 168,
  autoPauseOnExpiration: true,
});

/**
 * Builds non-overlapping StageSchedule list based on logical clock and policy.
 * Rule 1: Stage 1 startsAtTick = currentTick
 * Rule 2: Stage N startsAtTick = Stage (N-1).endsAtTick + cooldownTicks
 * Rule 3: endsAtTick = startsAtTick + stageDurationTicks
 */
export function generateStageSchedules(
  executionReport: ExecutionReport,
  startTick: number,
  policy: SchedulingPolicy
): readonly StageSchedule[] {
  const executionStages = executionReport.stages || [];
  let currentStart = startTick;

  return Object.freeze(
    executionStages.map((stg, idx) => {
      const sNum = idx + 1;
      const sStart = idx === 0 ? currentStart : currentStart + policy.cooldownTicks;
      const sEnd = sStart + policy.stageDurationTicks;
      currentStart = sEnd;

      return Object.freeze({
        stageNumber: sNum,
        trafficPercentage: stg.trafficPercentage,
        startsAtTick: sStart,
        endsAtTick: sEnd,
      });
    })
  );
}

/**
 * Builds a frozen ScheduleHistoryEntry.
 */
export function buildScheduleHistoryEntry(
  sequence: number,
  stageNumber: number,
  startsAtTick: number,
  endsAtTick: number
): Readonly<ScheduleHistoryEntry> {
  return Object.freeze({
    sequence,
    stageNumber,
    startsAtTick,
    endsAtTick,
  });
}
