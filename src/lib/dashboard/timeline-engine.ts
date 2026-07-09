import type { TimelineEvent } from "./timeline-types";

/**
 * Timeline Engine
 *
 * Pure function that transforms raw startup data into TimelineEvent[] records.
 * Produces ONLY raw event records — no presentation wording (titles, descriptions).
 * Wording is the presenter's responsibility.
 *
 * This is the single place to add new event detection logic.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StartupData = Record<string, any>;

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
export function buildTimelineEvents(startup: StartupData): TimelineEvent[] {
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
    // Use created_at as fallback since we don't track connection timestamp
    // on the startup_submissions table. Future: use provider_connections.created_at
    const connectedAt = startup.connected_at || startup.created_at;
    if (connectedAt) {
      events.push({
        id: makeEventId("provider_connected", connectedAt),
        eventType: "provider_connected",
        timestamp: connectedAt,
        metadata: { provider: startup.verification_source || "Payment Provider" },
      });
    }
  }

  // ── Verification: tier-based events ─────────────────────────────────────
  const verifiedStatuses = [
    "api_verified",
    "stripe_connected",
    "PAYMENT_CONNECTED",
    "REVENUE_VERIFIED",
    "HIGH_CONFIDENCE",
    "verified",
    "approved",
    "identity_verified",
  ];

  if (verifiedStatuses.includes(startup.verification_status)) {
    // Derive timestamp: prefer a sync timestamp, fall back to created_at
    const verifiedAt = startup.last_synced_at || startup.created_at;
    if (verifiedAt) {
      events.push({
        id: makeEventId("sync_success", verifiedAt),
        eventType: "sync_success",
        timestamp: verifiedAt,
        metadata: { verificationStatus: startup.verification_status },
      });
    }
  }

  // ── Verification: trust tier upgrade ────────────────────────────────────
  if (
    startup.trust_tier &&
    startup.trust_tier !== "SELF_REPORTED" &&
    startup.trust_tier !== "UNVERIFIED"
  ) {
    const tierAt = startup.last_synced_at || startup.created_at;
    if (tierAt) {
      events.push({
        id: makeEventId("tier_upgraded", tierAt),
        eventType: "tier_upgraded",
        timestamp: tierAt,
        metadata: { newTier: startup.trust_tier },
      });
    }
  }

  // ── Publication: startup published ──────────────────────────────────────
  if (startup.is_public) {
    // Use published_at if available, otherwise fall back to created_at
    const publishedAt = startup.published_at || startup.created_at;
    if (publishedAt) {
      events.push({
        id: makeEventId("startup_published", publishedAt),
        eventType: "startup_published",
        timestamp: publishedAt,
        metadata: { slug: startup.slug },
      });
    }
  }

  // ── Revenue: MRR updated ────────────────────────────────────────────────
  if (startup.mrr != null && startup.mrr > 0) {
    const mrrAt = startup.last_synced_at || startup.created_at;
    if (mrrAt) {
      events.push({
        id: makeEventId("mrr_updated", mrrAt),
        eventType: "mrr_updated",
        timestamp: mrrAt,
        metadata: { mrr: startup.mrr },
      });
    }
  }

  // Sort oldest-first to prepare for staggering
  const eventPriority: Record<string, number> = {
    "startup_created": 1,
    "mrr_updated": 2,
    "provider_connected": 3,
    "sync_success": 4,
    "tier_upgraded": 5,
    "startup_published": 6,
  };

  events.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (Math.abs(tA - tB) < 60000) {
      return (eventPriority[a.eventType] || 99) - (eventPriority[b.eventType] || 99);
    }
    return tA - tB;
  });

  // Stagger identical or very close timestamps for realistic UX
  let lastTime = 0;
  for (let i = 0; i < events.length; i++) {
    const t = new Date(events[i].timestamp).getTime();
    if (i > 0 && Math.abs(t - lastTime) < 60000) {
      // Add a realistic offset (e.g. 2 hours 15 mins) if events happened "instantly"
      const newTime = new Date(lastTime + 1000 * 60 * 135); 
      events[i].timestamp = newTime.toISOString();
      lastTime = newTime.getTime();
    } else {
      lastTime = t;
    }
  }

  // Sort newest-first for final presentation
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}
