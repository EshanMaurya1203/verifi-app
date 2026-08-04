/**
 * VRF-ONBOARD-001D.2 — Onboarding Analytics Tracker Engine
 *
 * Fire-and-forget client tracking utility for founder onboarding events.
 *
 * RULES & CONSTRAINTS:
 * - Pure tracking utility — zero React, DB, API route, or Supabase dependencies.
 * - Fire-and-forget contract — never throws, never blocks UI or onboarding flow.
 * - Deduplication window: 3000ms sliding window per `${event}:${step}:${startupId}` key using setTimeout.
 * - Uses native fetch with keepalive: true (no safeFetch dependency).
 * - Skips dispatch if isAuthenticated is false/falsy.
 * - Silently catches and ignores all network/execution failures.
 */

import {
  OnboardingEvent,
  SanitizedMetadata,
  validateEvent,
  validateStep,
  sanitizeMetadata,
} from "@/lib/analytics/validators";

// ─── Input Contract ───────────────────────────────────────────────────

export interface TrackOnboardingEventInput {
  event: OnboardingEvent;
  step?: number;
  startupId?: number;
  metadata?: SanitizedMetadata;
  isAuthenticated: boolean;
}

// ─── In-Memory Deduplication Engine ───────────────────────────────────

const DEDUPE_WINDOW_MS = 3000;
const activeDedupeKeys = new Set<string>();

// ─── Exported Tracker Function ────────────────────────────────────────

/**
 * Tracks an onboarding analytics event in a non-blocking, fire-and-forget manner.
 *
 * Key behaviors:
 * 1. Executes strictly in browser environments (`typeof window !== "undefined"`).
 * 2. Skips dispatch if caller is unauthenticated (`!input.isAuthenticated`).
 * 3. Validates event type, step boundaries, and sanitizes metadata.
 * 4. Applies a 3000ms sliding window deduplication per `${event}:${step}:${startupId}` via setTimeout.
 * 5. Dispatches to `/api/analytics/onboarding` via native `fetch` with `keepalive: true`.
 * 6. Guarantees zero thrown exceptions and zero user flow interruption.
 */
export function trackOnboardingEvent(input: TrackOnboardingEventInput): void {
  try {
    // 1. Browser context check
    if (typeof window === "undefined") {
      return;
    }

    // 2. Authentication check
    if (!input.isAuthenticated) {
      return;
    }

    // 2. Input validation
    const validEvent = validateEvent(input?.event);
    if (!validEvent) {
      return;
    }

    const validStep = validateStep(input?.step);
    const validStartupId =
      typeof input?.startupId === "number" &&
      Number.isInteger(input.startupId) &&
      input.startupId > 0
        ? input.startupId
        : undefined;

    // 3. Deduplication check using setTimeout cleanup
    const dedupeKey = `${validEvent}:${validStep ?? ""}:${validStartupId ?? ""}`;
    if (activeDedupeKeys.has(dedupeKey)) {
      return;
    }

    activeDedupeKeys.add(dedupeKey);
    setTimeout(() => {
      activeDedupeKeys.delete(dedupeKey);
    }, DEDUPE_WINDOW_MS);

    // 4. Metadata sanitization
    const sanitizedMeta = input?.metadata ? sanitizeMetadata(input.metadata) : {};

    // 5. Non-blocking fire-and-forget network dispatch with keepalive
    const payload = {
      event: validEvent,
      step: validStep,
      startupId: validStartupId,
      metadata: sanitizedMeta,
    };

    void fetch("/api/analytics/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget — silently absorb any unexpected fetch error
    });
  } catch (_err) {
    // Fire-and-forget safety net — never break client execution
  }
}
