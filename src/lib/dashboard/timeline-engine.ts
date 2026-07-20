import type { TimelineEvent } from "./timeline-types";
import { VERIFIED_STATUSES } from "./constants";
import type { StartupSubmissionRow } from "./startup-status";

/**
 * Timeline Engine
 *
 * Pure function that transforms raw startup data into TimelineEvent[] records.
 * Produces ONLY raw event records — no presentation wording (titles, descriptions).
 * Wording is the presenter's responsibility.
 *
 * This is the single place to add new event detection logic.
 */

type StartupData = Partial<StartupSubmissionRow>;

/**
 * Generate a deterministic event ID from eventType and timestamp.
 * Uses a simple hash to avoid collisions without requiring crypto.
 */
function makeEventId(eventType: string, timestamp: string): string {
  // Simple FNV-1a-inspired hash for deterministic short IDs
  let hash = 2166136261;
  const str = `${eventType}-${timestamp}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `${eventType}-${hash.toString(36)}`;
}

/**
 * Builds a flat list of TimelineEvent records from startup data.
 *
 * Each event is derived from observable startup fields — no hardcoded JSX,
 * no presentation wording. Returns events sorted newest-first.
 */
export function buildTimelineEvents(startup: StartupData | null | undefined): TimelineEvent[] {
  if (!startup) return [];

  const events: TimelineEvent[] = [];

  // ── Profile: startup created ────────────────────────────────────────────
  if (startup.created_at) {
    events.push({
      id: makeEventId("startup_created", startup.created_at),
      eventType: "startup_created",
      timestamp: startup.created_at,
      metadata: { startupName: startup.startup_name },
    });
  }

  // ── Provider: payment connected ─────────────────────────────────────────
  if (startup.payment_connected) {
    if (startup.connected_at) {
      events.push({
        id: makeEventId("provider_connected", startup.connected_at),
        eventType: "provider_connected",
        timestamp: startup.connected_at,
        metadata: { provider: startup.verification_source || "Payment Provider" },
      });
    }
    // EXCLUDED: If connected_at is missing, we omit the event instead of fabricating a timestamp.
  }

  // ── Verification: tier-based events ─────────────────────────────────────
  if (startup.verification_status && VERIFIED_STATUSES.includes(startup.verification_status)) {
    if (startup.last_synced_at) {
      events.push({
        id: makeEventId("sync_success", startup.last_synced_at),
        eventType: "sync_success",
        timestamp: startup.last_synced_at,
        metadata: { verificationStatus: startup.verification_status },
      });
    }
    // EXCLUDED: If last_synced_at is missing, we omit the event instead of fabricating a timestamp.
  }

  // ── Verification: trust tier upgrade ────────────────────────────────────
  if (
    startup.trust_tier &&
    startup.trust_tier !== "SELF_REPORTED" &&
    startup.trust_tier !== "UNVERIFIED"
  ) {
    if (startup.last_synced_at) {
      events.push({
        id: makeEventId("tier_upgraded", startup.last_synced_at),
        eventType: "tier_upgraded",
        timestamp: startup.last_synced_at,
        metadata: { newTier: startup.trust_tier },
      });
    }
    // EXCLUDED: If last_synced_at is missing, we omit the event instead of fabricating a timestamp.
  }

  // ── Publication: startup published ──────────────────────────────────────
  if (startup.is_public) {
    if (startup.published_at) {
      events.push({
        id: makeEventId("startup_published", startup.published_at),
        eventType: "startup_published",
        timestamp: startup.published_at,
        metadata: { slug: startup.slug },
      });
    }
    // EXCLUDED: If published_at is missing, we omit the event instead of fabricating a timestamp.
  }

  // ── Revenue: MRR updated ────────────────────────────────────────────────
  if (startup.mrr != null && startup.mrr > 0) {
    if (startup.last_synced_at) {
      events.push({
        id: makeEventId("mrr_updated", startup.last_synced_at),
        eventType: "mrr_updated",
        timestamp: startup.last_synced_at,
        metadata: { mrr: startup.mrr },
      });
    }
    // EXCLUDED: If last_synced_at is missing, we omit the event instead of fabricating a timestamp.
  }

  // Sort newest-first for final presentation
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}
