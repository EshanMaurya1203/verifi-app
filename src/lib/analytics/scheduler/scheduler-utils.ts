// ─── VRF-ONBOARD-003C / 003C.1 — Scheduler Utilities Module ───────────────

import type { ExperimentSchedule } from "./scheduler-types";

/**
 * Pure predicate checking if the current time has reached or passed startsAt.
 * Undefined startsAt implies the experiment has started (no start boundary).
 * Requires explicit timestamp injection (`now: Date`).
 */
export function hasStarted(startsAt: Date | undefined, now: Date): boolean {
  if (!startsAt) {
    return true;
  }
  return now.getTime() >= startsAt.getTime();
}

/**
 * Pure predicate checking if current time is strictly after endsAt.
 * Undefined endsAt implies the experiment never expires (no end boundary).
 * Requires explicit timestamp injection (`now: Date`).
 */
export function hasExpired(endsAt: Date | undefined, now: Date): boolean {
  if (!endsAt) {
    return false;
  }
  return now.getTime() > endsAt.getTime();
}

/**
 * Pure predicate evaluating if a schedule is enabled and within its temporal window.
 * Requires explicit timestamp injection (`now: Date`).
 */
export function isWithinWindow(schedule: ExperimentSchedule, now: Date): boolean {
  if (!schedule || schedule.enabled !== true) {
    return false;
  }
  return hasStarted(schedule.startsAt, now) && !hasExpired(schedule.endsAt, now);
}
