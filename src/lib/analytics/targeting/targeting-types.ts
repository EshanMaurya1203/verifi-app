// ─── VRF-ONBOARD-003B — Targeting Types Domain Module ─────────────────────

export interface EligibilityResult {
  eligible: boolean;

  matchedRules: string[];

  failedRules: string[];

  reason?: string;
}

export type ProviderType =
  | "stripe"
  | "razorpay";
