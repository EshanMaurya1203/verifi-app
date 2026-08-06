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
// ─── VRF-ONBOARD-002A / 002X — Event Tracker Module ──────────────────────

import type { OnboardingEventType, RuntimeEvent } from "./runtime-types";

let eventCounter = 0;

function generateEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

export function trackEvent(
  sessionId: string,
  eventType: OnboardingEventType,
  userId?: string,
  experimentId?: string,
  variantId?: string,
  metadata?: Record<string, unknown>
): RuntimeEvent {
  if (!sessionId || sessionId.trim() === "") {
    throw new Error("SessionId is required to track runtime events.");
  }
  if (!eventType) {
    throw new Error("EventType is required to track runtime events.");
  }

  return {
    id: generateEventId(),
    userId,
    sessionId: sessionId.trim(),
    eventType,
    experimentId,
    variantId,
    metadata,
    createdAt: new Date(),
  };
}

export function trackExperimentAssignment(
  sessionId: string,
  experimentId: string,
  variantId: string,
  userId?: string
): RuntimeEvent {
  return trackEvent(sessionId, "experiment_assigned", userId, experimentId, variantId);
}

export function trackVariantExposed(
  sessionId: string,
  experimentId: string,
  variantId: string,
  userId?: string
): RuntimeEvent {
  return trackEvent(sessionId, "variant_exposed", userId, experimentId, variantId);
}

export function trackVariantRendered(
  sessionId: string,
  experimentId: string,
  variantId: string,
  userId?: string
): RuntimeEvent {
  return trackEvent(sessionId, "variant_rendered", userId, experimentId, variantId);
}

export function trackVariantSeen(
  sessionId: string,
  experimentId: string,
  variantId: string,
  userId?: string
): RuntimeEvent {
  return trackVariantExposed(sessionId, experimentId, variantId, userId);
}

export function trackVariantCompletion(
  sessionId: string,
  experimentId: string,
  variantId: string,
  userId?: string
): RuntimeEvent {
  return trackEvent(sessionId, "variant_completed", userId, experimentId, variantId);
}
