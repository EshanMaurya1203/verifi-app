// ─── VRF-ONBOARD-003C & 005D — Experiment Scheduler Validator ────────────────

import type { ExecutionReport } from "../execution/execution-types";
import type { ExperimentSchedule, LogicalClock, SchedulingPolicy, ScheduleHistoryEntry } from "./scheduler-types";

export interface SchedulerValidationResult {
  passed: boolean;
  errors: string[];
}

// ─── 003C Legacy Schedule Validator ──────────────────────────────────────────
export function validateSchedule(schedule: ExperimentSchedule): SchedulerValidationResult {
  const errors: string[] = [];
  if (!schedule) {
    return { passed: false, errors: ["Schedule is required."] };
  }
  const startVal = schedule.startsAt || schedule.startDate;
  const endVal = schedule.endsAt || schedule.endDate;
  if (startVal && endVal) {
    const sMs = new Date(startVal).getTime();
    const eMs = new Date(endVal).getTime();
    if (sMs > eMs) {
      errors.push("startsAt must be less than or equal to endsAt.");
    }
  }
  return { passed: errors.length === 0, errors };
}

// ─── 005D Logical Clock Scheduler Request Validator ──────────────────────────
/**
 * Validates a scheduling request.
 * Rules:
 * 1. executionReport required with non-empty experimentId.
 * 2. clock required with currentTick >= 0 and integer.
 * 3. Policy rules: stageDurationTicks > 0, cooldownTicks >= 0, expirationTicks > 0.
 * 4. previousHistory: sequence strictly monotonic, startsAtTick < endsAtTick, no overlapping history entries.
 */
export function validateScheduleRequest(
  executionReport: ExecutionReport,
  previousHistory: readonly ScheduleHistoryEntry[],
  clock: LogicalClock,
  policy?: Partial<SchedulingPolicy>
): SchedulerValidationResult {
  const errors: string[] = [];

  if (!executionReport || typeof executionReport !== "object") {
    return { passed: false, errors: ["ExecutionReport payload is required."] };
  }

  if (!executionReport.experimentId || typeof executionReport.experimentId !== "string" || executionReport.experimentId.trim() === "") {
    errors.push("ExecutionReport requires a valid non-empty experimentId.");
  }

  if (!clock || typeof clock !== "object") {
    errors.push("LogicalClock payload is required.");
  } else if (typeof clock.currentTick !== "number" || isNaN(clock.currentTick) || clock.currentTick < 0 || !Number.isInteger(clock.currentTick)) {
    errors.push("LogicalClock currentTick must be an integer greater than or equal to 0.");
  }

  if (policy) {
    if (policy.stageDurationTicks !== undefined) {
      if (typeof policy.stageDurationTicks !== "number" || isNaN(policy.stageDurationTicks) || policy.stageDurationTicks <= 0) {
        errors.push("Policy stageDurationTicks must be a number greater than 0.");
      }
    }
    if (policy.cooldownTicks !== undefined) {
      if (typeof policy.cooldownTicks !== "number" || isNaN(policy.cooldownTicks) || policy.cooldownTicks < 0) {
        errors.push("Policy cooldownTicks must be a number greater than or equal to 0.");
      }
    }
    if (policy.expirationTicks !== undefined) {
      if (typeof policy.expirationTicks !== "number" || isNaN(policy.expirationTicks) || policy.expirationTicks <= 0) {
        errors.push("Policy expirationTicks must be a number greater than 0.");
      }
    }
  }

  if (previousHistory && Array.isArray(previousHistory)) {
    for (let i = 0; i < previousHistory.length; i++) {
      const entry = previousHistory[i];
      if (!entry || typeof entry.sequence !== "number" || isNaN(entry.sequence)) {
        errors.push(`History entry at index ${i} has invalid sequence.`);
      }
      if (entry && (entry.startsAtTick >= entry.endsAtTick)) {
        errors.push(`History entry at index ${i} has startsAtTick >= endsAtTick.`);
      }
      if (i > 0) {
        const prev = previousHistory[i - 1];
        if (entry.sequence <= prev.sequence) {
          errors.push(`History sequence numbers must be strictly monotonic (index ${i} seq ${entry.sequence} <= prev ${prev.sequence}).`);
        }
        if (entry.startsAtTick < prev.endsAtTick) {
          errors.push(`History windows overlap between index ${i - 1} and index ${i}.`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
