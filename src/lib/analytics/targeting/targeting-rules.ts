// ─── VRF-ONBOARD-003B — Targeting Rules Domain Module ─────────────────────

import type { ProviderType } from "./targeting-types";

export interface ExperimentTargetingRules {
  countries?: string[];

  providers?: ProviderType[];

  acquisitionSources?: string[];

  onboardingSteps?: string[];

  newUsersOnly?: boolean;

  returningUsersOnly?: boolean;
}
