import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Globe,
  LineChart,
  CreditCard,
  Pencil,
  Shield,
} from "lucide-react";

// ── Event Types (discriminated union — primary identifier) ────────────────────
export type TimelineEventType =
  // verification
  | "sync_success"
  | "sync_failure"
  | "tier_upgraded"
  | "tier_downgraded"
  // publication
  | "startup_published"
  | "startup_unpublished"
  // revenue
  | "mrr_updated"
  | "revenue_milestone"
  // provider
  | "provider_connected"
  | "provider_disconnected"
  // subscription
  | "plan_upgraded"
  | "plan_downgraded"
  | "trial_started"
  | "subscription_cancelled"
  // profile
  | "startup_created"
  | "profile_edited"
  // trust
  | "trust_score_changed"
  | "fraud_flag_raised";

// ── Categories (derived from eventType, never set manually) ──────────────────
export type TimelineCategory =
  | "verification"
  | "publication"
  | "revenue"
  | "provider"
  | "subscription"
  | "profile"
  | "trust";

// ── Severity / Visual Weight (derived from eventType, never set manually) ────
export type TimelineSeverity = "success" | "info" | "warning" | "error";

// ── Core Event Record (engine output — no presentation wording) ──────────────
export interface TimelineEvent {
  /** Unique key: `${eventType}-${timestamp hash}` */
  id: string;
  /** Primary identifier — drives all derived fields via the presenter */
  eventType: TimelineEventType;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Extensible payload (provider name, amount, tier, etc.) */
  metadata?: Record<string, unknown>;
}

// ── Presentable Event (after presentation mapper) ────────────────────────────
export interface PresentableTimelineEvent extends TimelineEvent {
  /** Derived from eventType */
  category: TimelineCategory;
  /** Derived from eventType */
  severity: TimelineSeverity;
  /** WHAT happened (user-facing) */
  title: string;
  /** WHY it matters (user-facing) */
  description: string;
}

// ── Grouped for display ─────────────────────────────────────────────────────
export interface TimelineDateGroup {
  /** "2026-07-09" (YYYY-MM-DD) */
  dateKey: string;
  /** "Today", "Yesterday", "Jul 7, 2026" */
  label: string;
  /** Events within this date, sorted newest-first */
  events: PresentableTimelineEvent[];
}

// ── Category Configuration (icon, label, color per category) ────────────────
export interface TimelineCategoryConfig {
  label: string;
  icon: LucideIcon;
  defaultSeverity: TimelineSeverity;
  /** Tailwind color token base (e.g. "emerald", "blue") */
  colorClass: string;
}

export const TIMELINE_CATEGORY_CONFIGS: Record<
  TimelineCategory,
  TimelineCategoryConfig
> = {
  verification: {
    label: "Verification",
    icon: ShieldCheck,
    defaultSeverity: "info",
    colorClass: "emerald",
  },
  publication: {
    label: "Publication",
    icon: Globe,
    defaultSeverity: "success",
    colorClass: "emerald",
  },
  revenue: {
    label: "Revenue",
    icon: LineChart,
    defaultSeverity: "info",
    colorClass: "purple",
  },
  provider: {
    label: "Provider",
    icon: CreditCard,
    defaultSeverity: "info",
    colorClass: "blue",
  },
  subscription: {
    label: "Subscription",
    icon: CreditCard,
    defaultSeverity: "info",
    colorClass: "purple",
  },
  profile: {
    label: "Profile",
    icon: Pencil,
    defaultSeverity: "info",
    colorClass: "blue",
  },
  trust: {
    label: "Trust",
    icon: Shield,
    defaultSeverity: "info",
    colorClass: "primary",
  },
};

// ── Severity → color mapping for components ─────────────────────────────────
export const SEVERITY_COLORS: Record<
  TimelineSeverity,
  { dot: string; bg: string; text: string }
> = {
  success: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
  },
  info: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    text: "text-red-500",
  },
};
