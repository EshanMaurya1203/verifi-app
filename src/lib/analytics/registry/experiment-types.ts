// ─── VRF-ONBOARD-003A / 003B / 003C — Experiment Registry & Definitions Types ──

import type { ExperimentTargetingRules } from "../targeting/targeting-rules";
import type { ExperimentSchedule } from "../scheduler/scheduler-types";

export type { ExperimentTargetingRules, ExperimentSchedule };
export type TargetingRules = ExperimentTargetingRules;

export type ExperimentStatus =
  | "draft"
  | "review"
  | "approved"
  | "active"
  | "paused"
  | "archived";

export interface ExperimentVariant {
  id: string;

  name: string;

  description?: string;

  weight: number;
}

export interface ExperimentDefinition {
  id: string;

  name: string;

  description: string;

  owner: string;

  /**
   * Mandatory string-based ownership identifier.
   * Future migration target: owner: ExperimentOwner.
   */
  ownerId: string;

  status: ExperimentStatus;

  version: number;

  createdAt: Date;

  updatedAt: Date;

  variants: ExperimentVariant[];

  targeting: ExperimentTargetingRules;

  schedule: ExperimentSchedule;

  successMetric: string;

  rollbackPlan: string;
}
