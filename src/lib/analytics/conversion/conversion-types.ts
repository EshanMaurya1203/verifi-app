// ─── VRF-ONBOARD-004C — Conversion Engine Types ──────────────────────────────

export type GoalType = "click" | "signup" | "purchase" | "custom";

export interface GoalDefinition {
  id: string;

  experimentId: string;

  name: string;

  type: GoalType;
}

export interface GoalCandidate {
  sessionId: string;

  experimentId: string;

  variantId: string;

  goalId: string;

  completedAt: Date;
}

/**
 * ARCHITECTURAL SEPARATION RULE:
 * GoalDefinition and ConversionEvent must remain permanently separated.
 * GoalDefinition defines rules; ConversionEvent records immutable facts.
 * ConversionEvent must NEVER embed GoalDefinition objects.
 */
export interface ConversionEvent {
  conversionId: string;

  sessionId: string;

  experimentId: string;

  variantId: string;

  goalId: string;

  completedAt: Date;
}

export interface ConversionResult {
  accepted: readonly ConversionEvent[];

  deduplicated: readonly ConversionEvent[];

  rejected: readonly ConversionEvent[];
}
