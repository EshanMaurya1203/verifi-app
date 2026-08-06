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
// ─── VRF-ONBOARD-005C — Deployment Executor Module ───────────────────────────

import { ExecutionValidationError } from "./execution-errors";
import type { RolloutPlan } from "../rollout/rollout-types";
import type { ExecutionPolicy, ExecutionState, ExecutionHistoryEntry, ExecutionReport, ExecutionResult } from "./execution-types";
import { DEFAULT_EXECUTION_POLICY, buildExecutionStages, buildHistoryEntry } from "./execution-utils";
import { validateExecutionRequest } from "./execution-validator";

/**
 * Deterministically executes a RolloutPlan into an ExecutionReport and audit-hardened history log.
 *
 * EXECUTION CONSTRAINTS:
 * 1. Safely executes rollout plans only into immutable reports.
 * 2. NEVER creates plans, computes analytics, significance, or decisions.
 * 3. Contains zero database writes, APIs, network calls, notifications, or automatic deployments.
 *
 * Rules:
 * - RULE 1: keep_running -> scheduled (or last state if previous history), stage 0, empty history if new
 * - RULE 2: increase_traffic -> executing, stage 1 (or stage S), history entry added
 * - RULE 3: decrease_traffic -> rolled_back, history entry added
 * - RULE 4: archive_experiment -> completed, final stage, history entry added
 * - RULE 5: autoPromote = false -> execution never advances stage automatically without explicit policy/plan update
 */
export function executeRollout(
  rolloutPlan: RolloutPlan,
  previousHistory: readonly ExecutionHistoryEntry[] = [],
  policy?: Partial<ExecutionPolicy>
): ExecutionResult {
  const validation = validateExecutionRequest(rolloutPlan, previousHistory, policy);
  if (!validation.passed) {
    throw new ExecutionValidationError(
      `Invalid execution request: ${validation.errors.join("; ")}`
    );
  }

  const effectivePolicy: ExecutionPolicy = {
    rolloutStages: policy?.rolloutStages ?? DEFAULT_EXECUTION_POLICY.rolloutStages,
    rollbackEnabled: policy?.rollbackEnabled ?? DEFAULT_EXECUTION_POLICY.rollbackEnabled,
    autoPromote: policy?.autoPromote ?? DEFAULT_EXECUTION_POLICY.autoPromote,
  };

  const nextSeq = previousHistory.length > 0 ? previousHistory[previousHistory.length - 1].sequence + 1 : 1;
  const numStages = effectivePolicy.rolloutStages.length;

  let currentState: ExecutionState = "scheduled";
  let currentStage = 0;
  let newHistory: readonly ExecutionHistoryEntry[] = Object.freeze([...previousHistory]);

  switch (rolloutPlan.action) {
    case "keep_running":
      if (previousHistory.length === 0) {
        currentState = "scheduled";
        currentStage = 0;
        newHistory = Object.freeze([]);
      } else {
        const last = previousHistory[previousHistory.length - 1];
        currentState = last.state;
        currentStage = last.stageNumber;
        newHistory = Object.freeze([...previousHistory]);
      }
      break;

    case "increase_traffic": {
      currentState = "executing";
      if (previousHistory.length === 0) {
        currentStage = 1;
      } else {
        const last = previousHistory[previousHistory.length - 1];
        if (effectivePolicy.autoPromote && last.stageNumber < numStages) {
          currentStage = last.stageNumber + 1;
        } else {
          currentStage = last.stageNumber > 0 ? last.stageNumber : 1;
        }
      }
      const trafficPct = effectivePolicy.rolloutStages[Math.max(0, currentStage - 1)] ?? 10;
      const entry = buildHistoryEntry(nextSeq, currentStage, trafficPct, "executing");
      newHistory = Object.freeze([...previousHistory, entry]);
      break;
    }

    case "decrease_traffic": {
      currentState = "rolled_back";
      currentStage = previousHistory.length > 0 ? previousHistory[previousHistory.length - 1].stageNumber : 1;
      const trafficPct = rolloutPlan.allocation?.candidatePercentage ?? 10;
      const entry = buildHistoryEntry(nextSeq, currentStage, trafficPct, "rolled_back");
      newHistory = Object.freeze([...previousHistory, entry]);
      break;
    }

    case "archive_experiment": {
      currentState = "completed";
      currentStage = numStages;
      const entry = buildHistoryEntry(nextSeq, currentStage, 0, "completed");
      newHistory = Object.freeze([...previousHistory, entry]);
      break;
    }

    case "pause_experiment":
    default: {
      currentState = "cancelled";
      currentStage = previousHistory.length > 0 ? previousHistory[previousHistory.length - 1].stageNumber : 0;
      const entry = buildHistoryEntry(nextSeq, currentStage, 0, "cancelled");
      newHistory = Object.freeze([...previousHistory, entry]);
      break;
    }
  }

  const stages = buildExecutionStages(effectivePolicy.rolloutStages, currentStage, currentState);

  const report: ExecutionReport = Object.freeze({
    experimentId: rolloutPlan.experimentId.trim(),
    action: rolloutPlan.action,
    currentStage,
    currentState,
    stages,
    executionHistory: newHistory,
    rollbackEnabled: effectivePolicy.rollbackEnabled,
  });

  return Object.freeze({
    report,
  });
}
