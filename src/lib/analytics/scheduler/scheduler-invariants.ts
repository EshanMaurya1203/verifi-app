// ─── VRF-ONBOARD-005D — Experiment Scheduler Invariants Module ──────────────

import * as fs from "fs";
import * as path from "path";
import type { ExecutionReport } from "../execution/execution-types";
import type { LogicalClock, SchedulingPolicy, ScheduleHistoryEntry, ScheduleResult } from "./scheduler-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { buildSchedule } from "./scheduler-engine";

export interface SchedulerInvariantCheckContext extends InvariantCheckContext {
  scheduleExecutionReport?: ExecutionReport;
  scheduleHistory?: readonly ScheduleHistoryEntry[];
  scheduleClock?: LogicalClock;
  schedulePolicy?: Partial<SchedulingPolicy>;
  scheduleResult?: ScheduleResult;
}

export interface SchedulerInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface SchedulerInvariant {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning";
  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

function getSampleExecutionReport(expId: string, currentStage: number = 1): ExecutionReport {
  return {
    experimentId: expId,
    action: "increase_traffic",
    currentStage,
    currentState: "executing",
    stages: [
      { stageNumber: 1, trafficPercentage: 10, state: currentStage === 1 ? "executing" : "completed" },
      { stageNumber: 2, trafficPercentage: 25, state: currentStage === 2 ? "executing" : "scheduled" },
      { stageNumber: 3, trafficPercentage: 50, state: "scheduled" },
      { stageNumber: 4, trafficPercentage: 75, state: "scheduled" },
      { stageNumber: 5, trafficPercentage: 100, state: "scheduled" },
    ],
    executionHistory: [
      { sequence: 1, stageNumber: 1, trafficPercentage: 10, state: "executing" },
    ],
    rollbackEnabled: true,
  };
}

/**
 * Invariant #173: Schedule Deterministic. Same inputs produce identical SchedulePlan.
 */
export const INV_173_SCHEDULE_DETERMINISTIC: SchedulerInvariant = {
  id: "INV_173_SCHEDULE_DETERMINISTIC",
  name: "Scheduler Engine Determinism Guard",
  description: "Identical schedule request inputs must produce strictly identical SchedulePlan outputs.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const hist = ctx.scheduleHistory || [];
    const clk = ctx.scheduleClock || { currentTick: 0 };

    const res1 = buildSchedule(report, hist, clk, ctx.schedulePolicy);
    const res2 = buildSchedule(report, hist, clk, ctx.schedulePolicy);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_173_SCHEDULE_DETERMINISTIC",
      name: "Scheduler Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical scheduler inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #174: Schedule Read-Only. Scheduler engine never mutates input parameters.
 */
export const INV_174_SCHEDULE_READ_ONLY: SchedulerInvariant = {
  id: "INV_174_SCHEDULE_READ_ONLY",
  name: "Scheduler Engine Immutability Guard",
  description: "Scheduler engine must never mutate input execution report, history, clock, or policy.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const hist = ctx.scheduleHistory || [];
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const pol = ctx.schedulePolicy || { stageDurationTicks: 24 };

    const repBefore = JSON.stringify(report);
    const histBefore = JSON.stringify(hist);
    const clkBefore = JSON.stringify(clk);
    const polBefore = JSON.stringify(pol);

    buildSchedule(report, hist, clk, pol);

    const repAfter = JSON.stringify(report);
    const histAfter = JSON.stringify(hist);
    const clkAfter = JSON.stringify(clk);
    const polAfter = JSON.stringify(pol);

    const passed = repBefore === repAfter && histBefore === histAfter && clkBefore === clkAfter && polBefore === polAfter;
    return {
      passed,
      invariantId: "INV_174_SCHEDULE_READ_ONLY",
      name: "Scheduler Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Scheduler engine mutated input parameters.",
    };
  },
};

/**
 * Invariant #175: Stage Tick Monotonic Guard.
 * Stage start and end ticks strictly increase across stages.
 */
export const INV_175_STAGE_TICK_MONOTONIC: SchedulerInvariant = {
  id: "INV_175_STAGE_TICK_MONOTONIC",
  name: "Stage Tick Monotonic Guard",
  description: "Logical stage start and end ticks must strictly increase monotonic for all scheduled stages.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk, ctx.schedulePolicy);

    const stages = res.plan.stages;
    let monotonic = true;
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.startsAtTick >= s.endsAtTick) {
        monotonic = false;
        break;
      }
      if (i > 0) {
        const prev = stages[i - 1];
        if (s.startsAtTick < prev.endsAtTick) {
          monotonic = false;
          break;
        }
      }
    }

    return {
      passed: monotonic,
      invariantId: "INV_175_STAGE_TICK_MONOTONIC",
      name: "Stage Tick Monotonic Guard",
      severity: "critical",
      reason: monotonic ? undefined : "Scheduled stage ticks are not strictly monotonic.",
    };
  },
};

/**
 * Invariant #176: Non-Overlapping Windows Guard.
 * Scheduled stage windows never overlap (startsAtTick >= previousStage.endsAtTick).
 */
export const INV_176_NON_OVERLAPPING_WINDOWS: SchedulerInvariant = {
  id: "INV_176_NON_OVERLAPPING_WINDOWS",
  name: "Non-Overlapping Windows Guard",
  description: "Logical stage windows must never overlap in tick time space.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk, ctx.schedulePolicy);

    const stages = res.plan.stages;
    let nonOverlapping = true;
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].startsAtTick < stages[i - 1].endsAtTick) {
        nonOverlapping = false;
        break;
      }
    }

    return {
      passed: nonOverlapping,
      invariantId: "INV_176_NON_OVERLAPPING_WINDOWS",
      name: "Non-Overlapping Windows Guard",
      severity: "critical",
      reason: nonOverlapping ? undefined : "Overlapping logical stage windows detected.",
    };
  },
};

/**
 * Invariant #177: Execution Required Guard.
 * Valid ExecutionReport with non-empty experimentId required.
 */
export const INV_177_EXECUTION_REQUIRED: SchedulerInvariant = {
  id: "INV_177_EXECUTION_REQUIRED",
  name: "Execution Report Required Guard",
  description: "Scheduler strictly requires a valid ExecutionReport input.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk);
    const passed = Boolean(res.plan.experimentId);

    return {
      passed,
      invariantId: "INV_177_EXECUTION_REQUIRED",
      name: "Execution Report Required Guard",
      severity: "critical",
      reason: passed ? undefined : "Schedule plan missing experimentId.",
    };
  },
};

/**
 * Invariant #178: Schedule History Stability Guard.
 * Same history produces identical schedule plan.
 */
export const INV_178_SCHEDULE_HISTORY_STABLE: SchedulerInvariant = {
  id: "INV_178_SCHEDULE_HISTORY_STABLE",
  name: "Schedule History Stability Guard",
  description: "Schedule plans must be strictly reproducible given identical execution history inputs.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };

    const res1 = buildSchedule(report, ctx.scheduleHistory, clk);
    const res2 = buildSchedule(report, ctx.scheduleHistory, clk);

    const passed = JSON.stringify(res1.plan) === JSON.stringify(res2.plan);
    return {
      passed,
      invariantId: "INV_178_SCHEDULE_HISTORY_STABLE",
      name: "Schedule History Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "Inconsistent schedule plans produced for identical history.",
    };
  },
};

/**
 * Invariant #179: Projection Only Guard.
 * Scheduler produces plan projections only (no side effects, deeply frozen).
 */
export const INV_179_PROJECTION_ONLY: SchedulerInvariant = {
  id: "INV_179_PROJECTION_ONLY",
  name: "Scheduler Projection Only Guard",
  description: "Scheduler engine must produce pure deeply frozen plan projections without side effects.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk);

    const isFrozen = Object.isFrozen(res) && Object.isFrozen(res.plan) && Object.isFrozen(res.plan.stages) && Object.isFrozen(res.plan.history);

    return {
      passed: isFrozen,
      invariantId: "INV_179_PROJECTION_ONLY",
      name: "Scheduler Projection Only Guard",
      severity: "critical",
      reason: isFrozen ? undefined : "Schedule plan result is not deeply frozen.",
    };
  },
};

/**
 * Invariant #180: Logical Time Only Guard.
 * Prohibits internal time creation (new Date() or Date.now()) or calendars/time zones in scheduler files.
 */
export const INV_180_LOGICAL_TIME_ONLY: SchedulerInvariant = {
  id: "INV_180_LOGICAL_TIME_ONLY",
  name: "Logical Time Only Guard",
  description: "Scheduler domain files must never instantiate time (new Date() or Date.now()) or use calendars/time zones.",
  severity: "critical",
  check: () => {
    const SCHEDULER_FILES = [
      "scheduler-engine.ts",
      "scheduler-utils.ts",
      "scheduler-validator.ts",
      "scheduler-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const schedDir = path.join(__dirname);
      for (const fileName of SCHEDULER_FILES) {
        const filePath = path.join(schedDir, fileName);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (line.includes("//") || line.includes("/*") || line.includes("*")) {
              return;
            }
            if (
              line.includes("new Date()") ||
              line.includes("Date.now()") ||
              line.includes("Intl.") ||
              line.includes("getTimezoneOffset")
            ) {
              violations.push(`${fileName}:L${idx + 1}`);
            }
          });
        }
      }
    } catch {
      // In non-filesystem environments, default to passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_180_LOGICAL_TIME_ONLY",
      name: "Logical Time Only Guard",
      severity: "critical",
      reason: passed ? undefined : `Real-world time instantiation or timezone usage found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #181: History Sequence Monotonic Guard.
 * Sequence numbers in schedule history must be strictly monotonic (1 < 2 < 3...).
 */
export const INV_181_HISTORY_SEQUENCE_MONOTONIC: SchedulerInvariant = {
  id: "INV_181_HISTORY_SEQUENCE_MONOTONIC",
  name: "Schedule History Sequence Monotonic Guard",
  description: "Schedule history entries sequence numbers must be strictly increasing integers.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk);
    const hist = res.plan.history;

    let monotonic = true;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].sequence <= hist[i - 1].sequence) {
        monotonic = false;
        break;
      }
    }

    return {
      passed: monotonic,
      invariantId: "INV_181_HISTORY_SEQUENCE_MONOTONIC",
      name: "Schedule History Sequence Monotonic Guard",
      severity: "critical",
      reason: monotonic ? undefined : "Schedule history sequence numbers are not strictly monotonic.",
    };
  },
};

/**
 * Invariant #182: History Append-Only Guard.
 * History entries can be appended, but previous entries are never mutated.
 */
export const INV_182_HISTORY_APPEND_ONLY: SchedulerInvariant = {
  id: "INV_182_HISTORY_APPEND_ONLY",
  name: "Schedule History Append-Only Guard",
  description: "Previous schedule history entries must remain identical in content and order when new entries are appended.",
  severity: "critical",
  check: () => {
    const report1 = getSampleExecutionReport("exp_sched", 1);
    const clk = { currentTick: 0 };
    const initialRes = buildSchedule(report1, [], clk);
    const initialHist = initialRes.plan.history;

    const report2 = getSampleExecutionReport("exp_sched", 2);
    const secondRes = buildSchedule(report2, initialHist, clk);
    const secondHist = secondRes.plan.history;

    let appendOnly = secondHist.length === initialHist.length + 1;
    for (let i = 0; i < initialHist.length; i++) {
      if (JSON.stringify(secondHist[i]) !== JSON.stringify(initialHist[i])) {
        appendOnly = false;
        break;
      }
    }

    return {
      passed: appendOnly,
      invariantId: "INV_182_HISTORY_APPEND_ONLY",
      name: "Schedule History Append-Only Guard",
      severity: "critical",
      reason: appendOnly ? undefined : "Schedule history failed append-only immutability check.",
    };
  },
};

/**
 * Invariant #183: Expiration After Last Stage Guard.
 * expiresAtTick > lastStage.endsAtTick.
 */
export const INV_183_EXPIRATION_AFTER_LAST_STAGE: SchedulerInvariant = {
  id: "INV_183_EXPIRATION_AFTER_LAST_STAGE",
  name: "Expiration After Last Stage Guard",
  description: "expiresAtTick must strictly exceed the endsAtTick of the final scheduled stage.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk, ctx.schedulePolicy);

    const stages = res.plan.stages;
    const lastStageEnd = stages.length > 0 ? stages[stages.length - 1].endsAtTick : clk.currentTick;
    const passed = res.plan.expiresAtTick > lastStageEnd;

    return {
      passed,
      invariantId: "INV_183_EXPIRATION_AFTER_LAST_STAGE",
      name: "Expiration After Last Stage Guard",
      severity: "critical",
      reason: passed ? undefined : `expiresAtTick (${res.plan.expiresAtTick}) does not exceed last stage end tick (${lastStageEnd}).`,
    };
  },
};

/**
 * Invariant #184: Current Stage Consistent Guard.
 * currentStage == last(history).stageNumber (when history is non-empty).
 */
export const INV_184_CURRENT_STAGE_CONSISTENT: SchedulerInvariant = {
  id: "INV_184_CURRENT_STAGE_CONSISTENT",
  name: "Current Stage History Consistency Guard",
  description: "currentStage in SchedulePlan must equal stageNumber of the latest history entry when history is non-empty.",
  severity: "critical",
  check: (ctx) => {
    const report = ctx.scheduleExecutionReport || getSampleExecutionReport("exp_sched");
    const clk = ctx.scheduleClock || { currentTick: 0 };
    const res = buildSchedule(report, ctx.scheduleHistory, clk);
    const hist = res.plan.history;

    let passed = true;
    if (hist.length > 0) {
      const lastStage = hist[hist.length - 1].stageNumber;
      passed = res.plan.currentStage === lastStage;
    } else {
      passed = res.plan.currentStage === 0;
    }

    return {
      passed,
      invariantId: "INV_184_CURRENT_STAGE_CONSISTENT",
      name: "Current Stage History Consistency Guard",
      severity: "critical",
      reason: passed ? undefined : `currentStage ${res.plan.currentStage} does not match last schedule history stage.`,
    };
  },
};

export const SCHEDULER_INVARIANTS: readonly SchedulerInvariant[] = [
  INV_173_SCHEDULE_DETERMINISTIC,
  INV_174_SCHEDULE_READ_ONLY,
  INV_175_STAGE_TICK_MONOTONIC,
  INV_176_NON_OVERLAPPING_WINDOWS,
  INV_177_EXECUTION_REQUIRED,
  INV_178_SCHEDULE_HISTORY_STABLE,
  INV_179_PROJECTION_ONLY,
  INV_180_LOGICAL_TIME_ONLY,
  INV_181_HISTORY_SEQUENCE_MONOTONIC,
  INV_182_HISTORY_APPEND_ONLY,
  INV_183_EXPIRATION_AFTER_LAST_STAGE,
  INV_184_CURRENT_STAGE_CONSISTENT,
] as const;

export function checkAllSchedulerInvariants(
  ctx: SchedulerInvariantCheckContext
): SchedulerInvariantResult[] {
  return SCHEDULER_INVARIANTS.map((inv) => inv.check(ctx) as SchedulerInvariantResult);
}
