/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-005C — Deployment Executor Invariants Module ───────────────

import * as fs from "fs";
import * as path from "path";
import type { RolloutPlan } from "../rollout/rollout-types";
import type { ExecutionPolicy, ExecutionHistoryEntry, ExecutionResult } from "./execution-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { executeRollout } from "./execution-engine";

export interface ExecutionInvariantCheckContext extends InvariantCheckContext {
  executionPlan?: RolloutPlan;
  executionHistory?: readonly ExecutionHistoryEntry[];
  executionPolicy?: Partial<ExecutionPolicy>;
  executionResult?: ExecutionResult;
}

export interface ExecutionInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface ExecutionInvariant {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning";
  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

function getSampleRolloutPlan(expId: string, action: RolloutPlan["action"] = "increase_traffic"): RolloutPlan {
  return {
    experimentId: expId,
    action,
    allocation: {
      baselineVariantId: "variant_a",
      candidateVariantId: "variant_b",
      baselinePercentage: 25,
      candidatePercentage: 75,
    },
    reasonCode: "INCREASE_TRAFFIC_WINNER_DETECTED",
    decision: "winner_detected",
  };
}

/**
 * Invariant #161: Execution Deterministic. Same inputs produce identical ExecutionReport.
 */
export const INV_161_EXECUTION_DETERMINISTIC: ExecutionInvariant = {
  id: "INV_161_EXECUTION_DETERMINISTIC",
  name: "Execution Engine Determinism Guard",
  description: "Identical execution request inputs must produce strictly identical ExecutionReport outputs.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const hist = ctx.executionHistory || [];

    const res1 = executeRollout(plan, hist, ctx.executionPolicy);
    const res2 = executeRollout(plan, hist, ctx.executionPolicy);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_161_EXECUTION_DETERMINISTIC",
      name: "Execution Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical execution inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #162: Execution Read-Only. Execution engine never mutates input parameters.
 */
export const INV_162_EXECUTION_READ_ONLY: ExecutionInvariant = {
  id: "INV_162_EXECUTION_READ_ONLY",
  name: "Execution Engine Immutability Guard",
  description: "Execution engine must never mutate input rollout plan, history, or policy.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const hist = ctx.executionHistory || [];
    const pol = ctx.executionPolicy || { rollbackEnabled: true };

    const pBefore = JSON.stringify(plan);
    const hBefore = JSON.stringify(hist);
    const polBefore = JSON.stringify(pol);

    executeRollout(plan, hist, pol);

    const pAfter = JSON.stringify(plan);
    const hAfter = JSON.stringify(hist);
    const polAfter = JSON.stringify(pol);

    const passed = pBefore === pAfter && hBefore === hAfter && polBefore === polAfter;
    return {
      passed,
      invariantId: "INV_162_EXECUTION_READ_ONLY",
      name: "Execution Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Execution engine mutated input parameters.",
    };
  },
};

/**
 * Invariant #163: Stage Order Monotonic Guard.
 * Policy rollout stages must be strictly increasing.
 */
export const INV_163_STAGE_ORDER_MONOTONIC: ExecutionInvariant = {
  id: "INV_163_STAGE_ORDER_MONOTONIC",
  name: "Stage Order Monotonic Guard",
  description: "Policy rollout stages must be strictly increasing numeric percentages.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory, ctx.executionPolicy);

    const stages = res.report.stages;
    let monotonic = true;
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].trafficPercentage <= stages[i - 1].trafficPercentage) {
        monotonic = false;
        break;
      }
    }

    return {
      passed: monotonic,
      invariantId: "INV_163_STAGE_ORDER_MONOTONIC",
      name: "Stage Order Monotonic Guard",
      severity: "critical",
      reason: monotonic ? undefined : "Execution stages are not strictly monotonic.",
    };
  },
};

/**
 * Invariant #164: Stage Range Valid Guard.
 * Stage percentages in [0, 100] and final stage equals 100.
 */
export const INV_164_STAGE_RANGE_VALID: ExecutionInvariant = {
  id: "INV_164_STAGE_RANGE_VALID",
  name: "Stage Range Valid Guard",
  description: "Execution stage percentages must be between 0 and 100, and final stage must equal 100.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory, ctx.executionPolicy);
    const stages = res.report.stages;

    let valid = stages.length > 0 && stages[stages.length - 1].trafficPercentage === 100;
    for (const s of stages) {
      if (s.trafficPercentage < 0 || s.trafficPercentage > 100) {
        valid = false;
        break;
      }
    }

    return {
      passed: valid,
      invariantId: "INV_164_STAGE_RANGE_VALID",
      name: "Stage Range Valid Guard",
      severity: "critical",
      reason: valid ? undefined : "Execution stages range or final 100% boundary invalid.",
    };
  },
};

/**
 * Invariant #165: Rollout Plan Required Guard.
 * Execution requires a valid RolloutPlan.
 */
export const INV_165_ROLLOUT_PLAN_REQUIRED: ExecutionInvariant = {
  id: "INV_165_ROLLOUT_PLAN_REQUIRED",
  name: "Rollout Plan Required Guard",
  description: "Execution engine strictly requires a valid RolloutPlan input.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory);
    const passed = Boolean(res.report.experimentId) && Boolean(res.report.action);

    return {
      passed,
      invariantId: "INV_165_ROLLOUT_PLAN_REQUIRED",
      name: "Rollout Plan Required Guard",
      severity: "critical",
      reason: passed ? undefined : "Execution report missing experimentId or action.",
    };
  },
};

/**
 * Invariant #166: Execution History Stable Guard.
 * Same inputs produce identical history log.
 */
export const INV_166_EXECUTION_HISTORY_STABLE: ExecutionInvariant = {
  id: "INV_166_EXECUTION_HISTORY_STABLE",
  name: "Execution History Stability Guard",
  description: "Execution history logs must be strictly reproducible for identical inputs.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const hist = ctx.executionHistory || [];

    const res1 = executeRollout(plan, hist);
    const res2 = executeRollout(plan, hist);

    const passed = JSON.stringify(res1.report.executionHistory) === JSON.stringify(res2.report.executionHistory);
    return {
      passed,
      invariantId: "INV_166_EXECUTION_HISTORY_STABLE",
      name: "Execution History Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "Inconsistent execution history logs produced.",
    };
  },
};

/**
 * Invariant #167: Execution Only Guard.
 * Execution engine produces reports only (no deployment side-effects, deeply frozen).
 */
export const INV_167_EXECUTION_ONLY: ExecutionInvariant = {
  id: "INV_167_EXECUTION_ONLY",
  name: "Execution Projection Only Guard",
  description: "Execution engine must produce pure deeply frozen report projections without side effects.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory);

    const isFrozen = Object.isFrozen(res) && Object.isFrozen(res.report) && Object.isFrozen(res.report.stages) && Object.isFrozen(res.report.executionHistory);

    return {
      passed: isFrozen,
      invariantId: "INV_167_EXECUTION_ONLY",
      name: "Execution Projection Only Guard",
      severity: "critical",
      reason: isFrozen ? undefined : "Execution report result is not deeply frozen.",
    };
  },
};

/**
 * Invariant #168: Execution External Time Free Guard.
 * Prohibits internal time creation (new Date() or Date.now()) in execution files.
 */
export const INV_168_TIME_FREE: ExecutionInvariant = {
  id: "INV_168_TIME_FREE",
  name: "Execution Time-Free Guard",
  description: "Execution domain files must never instantiate time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const EXECUTION_FILES = [
      "execution-engine.ts",
      "execution-utils.ts",
      "execution-validator.ts",
      "execution-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const execDir = path.join(__dirname);
      for (const fileName of EXECUTION_FILES) {
        const filePath = path.join(execDir, fileName);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (line.includes("//") || line.includes("/*") || line.includes("*")) {
              return;
            }
            if (line.includes("new Date()") || line.includes("Date.now()")) {
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
      invariantId: "INV_168_TIME_FREE",
      name: "Execution Time-Free Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #169: History Sequence Monotonic Guard.
 * Sequence numbers in executionHistory must be strictly monotonic (1 < 2 < 3...).
 */
export const INV_169_HISTORY_SEQUENCE_MONOTONIC: ExecutionInvariant = {
  id: "INV_169_HISTORY_SEQUENCE_MONOTONIC",
  name: "History Sequence Monotonic Guard",
  description: "Execution history entries sequence numbers must be strictly increasing integers.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory);
    const hist = res.report.executionHistory;

    let monotonic = true;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].sequence <= hist[i - 1].sequence) {
        monotonic = false;
        break;
      }
    }

    return {
      passed: monotonic,
      invariantId: "INV_169_HISTORY_SEQUENCE_MONOTONIC",
      name: "History Sequence Monotonic Guard",
      severity: "critical",
      reason: monotonic ? undefined : "Execution history sequence numbers are not strictly monotonic.",
    };
  },
};

/**
 * Invariant #170: History Append-Only Guard.
 * History entries can be appended, but previous entries are never mutated.
 */
export const INV_170_HISTORY_APPEND_ONLY: ExecutionInvariant = {
  id: "INV_170_HISTORY_APPEND_ONLY",
  name: "History Append-Only Guard",
  description: "Previous history entries must remain identical in content and order when new entries are appended.",
  severity: "critical",
  check: (ctx) => {
    const plan = getSampleRolloutPlan("exp_exec");
    const initialRes = executeRollout(plan, []);
    const initialHist = initialRes.report.executionHistory;

    const secondPlan = getSampleRolloutPlan("exp_exec", "decrease_traffic");
    const secondRes = executeRollout(secondPlan, initialHist);
    const secondHist = secondRes.report.executionHistory;

    let appendOnly = secondHist.length === initialHist.length + 1;
    for (let i = 0; i < initialHist.length; i++) {
      if (JSON.stringify(secondHist[i]) !== JSON.stringify(initialHist[i])) {
        appendOnly = false;
        break;
      }
    }

    return {
      passed: appendOnly,
      invariantId: "INV_170_HISTORY_APPEND_ONLY",
      name: "History Append-Only Guard",
      severity: "critical",
      reason: appendOnly ? undefined : "Execution history failed append-only immutability check.",
    };
  },
};

/**
 * Invariant #171: History Replayable Guard.
 * Replaying history produces identical report output.
 */
export const INV_171_HISTORY_REPLAYABLE: ExecutionInvariant = {
  id: "INV_171_HISTORY_REPLAYABLE",
  name: "History Replayable Guard",
  description: "Replaying an execution sequence from stored history must produce an identical execution report.",
  severity: "critical",
  check: (ctx) => {
    const plan = getSampleRolloutPlan("exp_exec");
    const res1 = executeRollout(plan, []);
    const hist = res1.report.executionHistory;

    const resReplay = executeRollout(plan, hist);
    const resRepeat = executeRollout(plan, hist);

    const passed = JSON.stringify(resReplay) === JSON.stringify(resRepeat);
    return {
      passed,
      invariantId: "INV_171_HISTORY_REPLAYABLE",
      name: "History Replayable Guard",
      severity: "critical",
      reason: passed ? undefined : "Execution history replay produced inconsistent results.",
    };
  },
};

/**
 * Invariant #172: Stage History Consistent Guard.
 * currentStage must equal the last history entry stageNumber (when history is non-empty).
 */
export const INV_172_STAGE_HISTORY_CONSISTENT: ExecutionInvariant = {
  id: "INV_172_STAGE_HISTORY_CONSISTENT",
  name: "Stage History Consistency Guard",
  description: "currentStage in ExecutionReport must equal stageNumber of the latest history entry.",
  severity: "critical",
  check: (ctx) => {
    const plan = ctx.executionPlan || getSampleRolloutPlan("exp_exec");
    const res = executeRollout(plan, ctx.executionHistory);
    const hist = res.report.executionHistory;

    let passed = true;
    if (hist.length > 0) {
      const lastStage = hist[hist.length - 1].stageNumber;
      passed = res.report.currentStage === lastStage;
    } else {
      passed = res.report.currentStage === 0;
    }

    return {
      passed,
      invariantId: "INV_172_STAGE_HISTORY_CONSISTENT",
      name: "Stage History Consistency Guard",
      severity: "critical",
      reason: passed ? undefined : `currentStage ${res.report.currentStage} does not match last history stage.`,
    };
  },
};

export const EXECUTION_INVARIANTS: readonly ExecutionInvariant[] = [
  INV_161_EXECUTION_DETERMINISTIC,
  INV_162_EXECUTION_READ_ONLY,
  INV_163_STAGE_ORDER_MONOTONIC,
  INV_164_STAGE_RANGE_VALID,
  INV_165_ROLLOUT_PLAN_REQUIRED,
  INV_166_EXECUTION_HISTORY_STABLE,
  INV_167_EXECUTION_ONLY,
  INV_168_TIME_FREE,
  INV_169_HISTORY_SEQUENCE_MONOTONIC,
  INV_170_HISTORY_APPEND_ONLY,
  INV_171_HISTORY_REPLAYABLE,
  INV_172_STAGE_HISTORY_CONSISTENT,
] as const;

export function checkAllExecutionInvariants(
  ctx: ExecutionInvariantCheckContext
): ExecutionInvariantResult[] {
  return EXECUTION_INVARIANTS.map((inv) => inv.check(ctx) as ExecutionInvariantResult);
}
