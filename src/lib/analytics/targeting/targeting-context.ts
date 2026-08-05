// ─── VRF-ONBOARD-003B — Targeting Context Domain Module ───────────────────

import type { ProviderType } from "./targeting-types";

export interface TargetingContext {
  userId?: string;

  anonymousId?: string;

  country?: string;

  provider?: ProviderType;

  acquisitionSource?: string;

  onboardingStep?: string;

  signupDate?: Date;

  isReturningUser: boolean;

  traits?: Record<string, unknown>;
}
