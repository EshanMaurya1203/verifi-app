export type RecommendationEntityType =
  | "step"
  | "provider"
  | "journey"
  | "recovery";

export interface RecommendationTarget {
  entityType: RecommendationEntityType;
  entityId: string;
}

/**
 * Thrown when a recommendation is constructed with a missing or invalid target.
 * This error must be caught at the recommendation generation boundary —
 * the API layer should log the error and exclude the invalid recommendation
 * while continuing to return all valid recommendations.
 */
export class InvalidRecommendationTargetError extends Error {
  constructor(target: unknown) {
    super(
      `Invalid recommendation target: ${JSON.stringify(target)}. ` +
        `Both entityType and entityId are required.`
    );
    this.name = "InvalidRecommendationTargetError";
  }
}

/**
 * Builds a unique entity key for a recommendation target
 * (e.g., "step:provider_connection", "provider:razorpay").
 *
 * @throws {InvalidRecommendationTargetError} if target, entityType, or entityId is missing.
 */
export function buildRecommendationKey(target: RecommendationTarget): string {
  if (!target || !target.entityType || !target.entityId) {
    throw new InvalidRecommendationTargetError(target);
  }
  return `${target.entityType}:${target.entityId}`;
}
