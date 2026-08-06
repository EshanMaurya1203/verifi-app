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
// ─── VRF-ONBOARD-005C — Deployment Executor Projections Module ───────────────

import type { ExecutionStage, ExecutionHistoryEntry, ExecutionReport, ExecutionResult } from "./execution-types";

/**
 * Projects a deeply frozen ExecutionStage.
 */
export function projectExecutionStage(stage: ExecutionStage): Readonly<ExecutionStage> {
  return Object.freeze({
    stageNumber: stage.stageNumber,
    trafficPercentage: stage.trafficPercentage,
    state: stage.state,
  });
}

/**
 * Projects a deeply frozen ExecutionHistoryEntry.
 */
export function projectExecutionHistoryEntry(entry: ExecutionHistoryEntry): Readonly<ExecutionHistoryEntry> {
  return Object.freeze({
    sequence: entry.sequence,
    stageNumber: entry.stageNumber,
    trafficPercentage: entry.trafficPercentage,
    state: entry.state,
  });
}

/**
 * Projects a deeply frozen ExecutionReport.
 */
export function projectExecutionReport(report: ExecutionReport): Readonly<ExecutionReport> {
  return Object.freeze({
    experimentId: report.experimentId,
    action: report.action,
    currentStage: report.currentStage,
    currentState: report.currentState,
    stages: Object.freeze(report.stages.map(projectExecutionStage)),
    executionHistory: Object.freeze(report.executionHistory.map(projectExecutionHistoryEntry)),
    rollbackEnabled: report.rollbackEnabled,
  });
}

/**
 * Projects a deeply frozen ExecutionResult.
 */
export function projectExecutionResult(res: ExecutionResult): Readonly<ExecutionResult> {
  return Object.freeze({
    report: projectExecutionReport(res.report),
  });
}
