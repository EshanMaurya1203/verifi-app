// ─── VRF-ONBOARD-003C — Scheduler Validator Module ────────────────────────

import type { ExperimentSchedule } from "./scheduler-types";

export interface ScheduleValidationResult {
  passed: boolean;

  errors: string[];
}

/**
 * Validates an ExperimentSchedule for structural and temporal integrity.
 *
 * Rules:
 * ✓ enabled is required (must be boolean)
 * ✓ startsAt <= endsAt (if both exist)
 * ✓ identical timestamps allowed
 * ✓ invalid windows rejected
 */
export function validateSchedule(
  schedule: ExperimentSchedule
): ScheduleValidationResult {
  const errors: string[] = [];

  if (!schedule) {
    errors.push("Schedule definition is missing.");
    return { passed: false, errors };
  }

  if (typeof schedule.enabled !== "boolean") {
    errors.push("Schedule 'enabled' flag must be a boolean.");
  }

  if (schedule.startsAt && isNaN(schedule.startsAt.getTime())) {
    errors.push("Schedule 'startsAt' must be a valid Date.");
  }

  if (schedule.endsAt && isNaN(schedule.endsAt.getTime())) {
    errors.push("Schedule 'endsAt' must be a valid Date.");
  }

  if (
    schedule.startsAt &&
    schedule.endsAt &&
    !isNaN(schedule.startsAt.getTime()) &&
    !isNaN(schedule.endsAt.getTime())
  ) {
    if (schedule.startsAt.getTime() > schedule.endsAt.getTime()) {
      errors.push("Invalid schedule window: startsAt must be less than or equal to endsAt.");
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
