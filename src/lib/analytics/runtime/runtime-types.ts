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
// ─── VRF-ONBOARD-004A & 002A — Runtime Types ───────────────────────────────

import type { GovernanceActor } from "../governance/governance-types";
import type { TargetingContext } from "../targeting/targeting-context";

export type OnboardingEventType =
  | "onboarding_started"
  | "step_1_completed"
  | "step_2_completed"
  | "step_3_completed"
  | "submission_completed"
  | "submission_failed"
  | "draft_restored"
  | "draft_discarded"
  | "signup_started"
  | (string & {});

export interface RuntimeEvent {
  id?: string;

  eventId?: string;

  sessionId: string;

  userId?: string;

  eventType: OnboardingEventType;

  timestamp?: Date;

  createdAt?: Date;

  experimentId?: string;

  variantId?: string;

  metadata?: Record<string, unknown>;
}

export interface RuntimeRequest {
  sessionId: string;

  actor: GovernanceActor;

  targetingContext: TargetingContext;

  now: Date;
}

export interface RuntimeAssignment {
  experimentId: string;

  variantId: string;

  assignmentKey: string;
}

export type RuntimeSkipReason =
  | "governance"
  | "schedule"
  | "targeting"
  | "archived"
  | "paused";

export interface RuntimeSkipped {
  experimentId: string;

  reason: RuntimeSkipReason;
}

export interface RuntimeResult {
  assignments: readonly RuntimeAssignment[];

  skipped: readonly RuntimeSkipped[];

  evaluatedExperiments: readonly string[];
}
