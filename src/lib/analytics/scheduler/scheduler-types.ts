// ─── VRF-ONBOARD-003C & 005D — Experiment Scheduler Types ───────────────────

import type { ExecutionReport } from "../execution/execution-types";

// ─── 003C Legacy Schedule Types ──────────────────────────────────────────────
export interface ExperimentSchedule {
  enabled: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  startsAt?: Date;
  endsAt?: Date;
  timezone?: string;
}

export interface ScheduleEvaluationResult {
  active: boolean;
  reason?: string;
  matchedChecks: readonly string[];
  failedChecks: readonly string[];
}

// ─── 005D Logical Clock Scheduler Types ──────────────────────────────────────
export interface LogicalClock {
  currentTick: number;
}

export interface SchedulingPolicy {
  stageDurationTicks: number;
  cooldownTicks: number;
  expirationTicks: number;
  autoPauseOnExpiration: boolean;
}

export interface StageSchedule {
  stageNumber: number;
  trafficPercentage: number;
  startsAtTick: number;
  endsAtTick: number;
}

export interface ScheduleHistoryEntry {
  sequence: number;
  stageNumber: number;
  startsAtTick: number;
  endsAtTick: number;
}

export interface SchedulePlan {
  experimentId: string;
  currentStage: number;
  stages: readonly StageSchedule[];
  history: readonly ScheduleHistoryEntry[];
  expiresAtTick: number;
  autoPauseOnExpiration: boolean;
}

export interface ScheduleResult {
  plan: SchedulePlan;
}
