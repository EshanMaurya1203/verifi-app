// ─── VRF-ONBOARD-002D — Kill Switch & Feature Flags Domain Types ────────

import type { RouterResult } from "./router-types";

export interface RuntimeFlags {
  globalKillSwitch: boolean;

  forceControl: boolean;

  pausedExperiments: Set<string>;

  forcedVariants: Map<string, string>;

  allowlistedUsers: Set<string>;

  blocklistedUsers: Set<string>;
}

export interface FlagDecision {
  allowed: boolean;

  reason:
    | "normal"
    | "global_kill_switch"
    | "force_control"
    | "experiment_paused"
    | "forced_variant"
    | "allowlisted"
    | "blocklisted";

  forcedVariantId?: string;
}

/**
 * Creates a default RuntimeFlags instance with all safety mechanisms disabled.
 */
export function createDefaultFlags(): RuntimeFlags {
  return {
    globalKillSwitch: false,
    forceControl: false,
    pausedExperiments: new Set<string>(),
    forcedVariants: new Map<string, string>(),
    allowlistedUsers: new Set<string>(),
    blocklistedUsers: new Set<string>(),
  };
}
