import type {
  TimelineEvent,
  TimelineEventType,
  TimelineCategory,
  TimelineSeverity,
  PresentableTimelineEvent,
} from "./timeline-types";

/**
 * Timeline Presenter
 *
 * Maps raw TimelineEvent records (from the engine) into PresentableTimelineEvent
 * records with user-facing titles, descriptions, category, and severity.
 *
 * All presentation wording lives here — the engine and components are wording-free.
 */

// ── Event Type Map ──────────────────────────────────────────────────────────
// Each eventType maps to its derived category, severity, title, and description.
// Description can be a static string or a function that receives metadata.

interface EventTypeConfig {
  category: TimelineCategory;
  severity: TimelineSeverity;
  title: string;
  description: string | ((metadata?: Record<string, unknown>) => string);
}

const EVENT_TYPE_MAP: Record<TimelineEventType, EventTypeConfig> = {
  // ── Verification ──────────────────────────────────────────────────────
  sync_success: {
    category: "verification",
    severity: "success",
    title: "Revenue Verified",
    description: "Your revenue data has been synced and verified.",
  },
  sync_failure: {
    category: "verification",
    severity: "error",
    title: "Sync Failed",
    description:
      "Revenue sync encountered an error. Check your provider credentials.",
  },
  tier_upgraded: {
    category: "verification",
    severity: "success",
    title: "Trust Tier Upgraded",
    description: (m) =>
      `Your trust tier upgraded to ${formatTierName(m?.newTier as string) ?? "a higher level"}.`,
  },
  tier_downgraded: {
    category: "verification",
    severity: "warning",
    title: "Trust Tier Downgraded",
    description:
      "Your trust tier has decreased. Ensure your sync is active.",
  },

  // ── Publication ───────────────────────────────────────────────────────
  startup_published: {
    category: "publication",
    severity: "success",
    title: "Startup Published",
    description: "Your verified profile is now live and discoverable.",
  },
  startup_unpublished: {
    category: "publication",
    severity: "warning",
    title: "Startup Unpublished",
    description: "Your profile has been taken private.",
  },

  // ── Revenue ───────────────────────────────────────────────────────────
  mrr_updated: {
    category: "revenue",
    severity: "info",
    title: "MRR Updated",
    description: "Your monthly recurring revenue has been recalculated.",
  },
  revenue_milestone: {
    category: "revenue",
    severity: "success",
    title: "Revenue Milestone",
    description: (m) =>
      `You've crossed ${(m?.milestone as string) ?? "a new revenue milestone"}!`,
  },

  // ── Provider ──────────────────────────────────────────────────────────
  provider_connected: {
    category: "provider",
    severity: "success",
    title: "Provider Connected",
    description: (m) =>
      `${(m?.provider as string) ?? "Payment provider"} is now linked. Revenue data can sync automatically.`,
  },
  provider_disconnected: {
    category: "provider",
    severity: "warning",
    title: "Provider Disconnected",
    description:
      "A payment provider has been disconnected. Revenue sync is paused.",
  },

  // ── Subscription ──────────────────────────────────────────────────────
  plan_upgraded: {
    category: "subscription",
    severity: "success",
    title: "Plan Upgraded",
    description: (m) =>
      `You've upgraded to the ${(m?.planName as string) ?? "new"} plan.`,
  },
  plan_downgraded: {
    category: "subscription",
    severity: "info",
    title: "Plan Changed",
    description: "Your subscription plan has been updated.",
  },
  trial_started: {
    category: "subscription",
    severity: "info",
    title: "Trial Started",
    description: "Your free trial has begun. Explore all features.",
  },
  subscription_cancelled: {
    category: "subscription",
    severity: "warning",
    title: "Subscription Cancelled",
    description:
      "Your subscription will end at the current billing period.",
  },

  // ── Profile ───────────────────────────────────────────────────────────
  startup_created: {
    category: "profile",
    severity: "success",
    title: "Startup Created",
    description: (m) =>
      `${(m?.startupName as string) ?? "Your startup"} has been submitted to Verifii.`,
  },
  profile_edited: {
    category: "profile",
    severity: "info",
    title: "Profile Updated",
    description: "Your startup profile details have been changed.",
  },

  // ── Trust ─────────────────────────────────────────────────────────────
  trust_score_changed: {
    category: "trust",
    severity: "info",
    title: "Trust Score Updated",
    description:
      "Your trust score has been recalculated based on new data.",
  },
  fraud_flag_raised: {
    category: "trust",
    severity: "error",
    title: "Anomaly Detected",
    description:
      "Unusual activity was flagged. This may affect your trust score.",
  },
};

/**
 * Formats a raw tier name (e.g. "REVENUE_VERIFIED") into a human-readable form.
 */
function formatTierName(tier: string | undefined | null): string | null {
  if (!tier) return null;
  return tier
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve the description for a given event type config and metadata.
 */
function resolveDescription(
  config: EventTypeConfig,
  metadata?: Record<string, unknown>
): string {
  if (typeof config.description === "function") {
    return config.description(metadata);
  }
  return config.description;
}

/**
 * Maps a single raw TimelineEvent to a PresentableTimelineEvent.
 */
export function presentEvent(event: TimelineEvent): PresentableTimelineEvent {
  const config = EVENT_TYPE_MAP[event.eventType];

  return {
    ...event,
    category: config.category,
    severity: config.severity,
    title: config.title,
    description: resolveDescription(config, event.metadata),
  };
}

/**
 * Maps an array of raw TimelineEvent records to PresentableTimelineEvent records.
 * Preserves input order.
 */
export function presentTimelineEvents(
  events: TimelineEvent[]
): PresentableTimelineEvent[] {
  return events.map(presentEvent);
}
