/**
 * Centralized Notification Registry (NTF-000A).
 * 
 * Maps every NotificationType to its declarative definition metadata:
 * Category, Priority, Default Channels, and Template References.
 * 
 * Eliminates switch statements scattered throughout the codebase.
 */

import type {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  NotificationMetadataDefinition,
} from "./types";

/**
 * Authoritative registry of all notification metadata definitions.
 */
export const NOTIFICATION_DEFINITIONS: Record<NotificationType, NotificationMetadataDefinition> = {
  WELCOME: {
    type: "WELCOME",
    category: "ACCOUNT",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "welcome",
    inAppTemplateRef: "in_app_welcome",
    pushTemplateRef: "push_welcome",
  },
  PROVIDER_CONNECTED: {
    type: "PROVIDER_CONNECTED",
    category: "VERIFICATION",
    priority: "NORMAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "provider-connected",
    inAppTemplateRef: "in_app_provider_connected",
  },
  PROVIDER_SYNC_FAILED: {
    type: "PROVIDER_SYNC_FAILED",
    category: "VERIFICATION",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "provider-sync-failed",
    inAppTemplateRef: "in_app_provider_sync_failed",
  },
  ACCOUNT_DELETED: {
    type: "ACCOUNT_DELETED",
    category: "ACCOUNT",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "account-deleted",
  },
  REVENUE_SYNC_REMINDER: {
    type: "REVENUE_SYNC_REMINDER",
    category: "VERIFICATION",
    priority: "LOW",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "revenue-sync-reminder",
  },
  TRIAL_EXPIRING: {
    type: "TRIAL_EXPIRING",
    category: "BILLING",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "trial-expiring",
  },
  PLAN_EXPIRED: {
    type: "PLAN_EXPIRED",
    category: "BILLING",
    priority: "CRITICAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "plan-expired",
  },
  PAYMENT_FAILED: {
    type: "PAYMENT_FAILED",
    category: "BILLING",
    priority: "CRITICAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "payment-failed",
  },
  SUBSCRIPTION_ACTIVATED: {
    type: "SUBSCRIPTION_ACTIVATED",
    category: "BILLING",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "subscription-activated",
  },
  SUBSCRIPTION_RENEWED: {
    type: "SUBSCRIPTION_RENEWED",
    category: "BILLING",
    priority: "NORMAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "subscription-renewed",
  },
  SUBSCRIPTION_CANCELLED: {
    type: "SUBSCRIPTION_CANCELLED",
    category: "BILLING",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "subscription-cancelled",
  },
  TRUST_SCORE_CHANGED: {
    type: "TRUST_SCORE_CHANGED",
    category: "VERIFICATION",
    priority: "NORMAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "trust-score-changed",
  },
  LEADERBOARD_CHANGED: {
    type: "LEADERBOARD_CHANGED",
    category: "GROWTH",
    priority: "LOW",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "leaderboard-changed",
  },
  SECURITY_ALERT: {
    type: "SECURITY_ALERT",
    category: "SECURITY",
    priority: "CRITICAL",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "security-alert",
  },
  PRODUCT_UPDATE: {
    type: "PRODUCT_UPDATE",
    category: "PRODUCT",
    priority: "LOW",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "product-update",
  },
  FEATURE_ANNOUNCEMENT: {
    type: "FEATURE_ANNOUNCEMENT",
    category: "PRODUCT",
    priority: "LOW",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "feature-announcement",
  },
  VERIFICATION_COMPLETED: {
    type: "VERIFICATION_COMPLETED",
    category: "VERIFICATION",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "verification-completed",
    inAppTemplateRef: "in_app_verification_completed",
  },
  VERIFICATION_FAILED: {
    type: "VERIFICATION_FAILED",
    category: "VERIFICATION",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "verification-failed",
    inAppTemplateRef: "in_app_verification_failed",
  },
  PRODUCTION_EMAIL_TEST: {
    type: "PRODUCTION_EMAIL_TEST",
    category: "SYSTEM",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "production-email-test",
  },
  FEEDBACK_SUBMITTED: {
    type: "FEEDBACK_SUBMITTED",
    category: "PRODUCT",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "feedback-submitted-admin",
  },
  FEEDBACK_REPLIED: {
    type: "FEEDBACK_REPLIED",
    category: "PRODUCT",
    priority: "HIGH",
    defaultChannels: ["EMAIL"],
    emailTemplateRef: "feedback-replied",
  },
};

/**
 * Backwards compatible channel map used by the dispatcher.
 */
export const notificationRegistry: Record<NotificationType, NotificationChannel[]> = Object.fromEntries(
  Object.entries(NOTIFICATION_DEFINITIONS).map(([type, def]) => [type, def.defaultChannels])
) as Record<NotificationType, NotificationChannel[]>;

/**
 * Resolves full metadata definition for a given NotificationType.
 */
export function getNotificationDefinition(type: NotificationType): NotificationMetadataDefinition {
  const def = NOTIFICATION_DEFINITIONS[type];
  if (!def) {
    throw new Error(`[NotificationRegistry] Unregistered notification type: ${type}`);
  }
  return def;
}

/**
 * Resolves category for a given NotificationType.
 */
export function getNotificationCategory(type: NotificationType): NotificationCategory {
  return getNotificationDefinition(type).category;
}

/**
 * Resolves priority for a given NotificationType.
 */
export function getNotificationPriority(type: NotificationType): NotificationPriority {
  return getNotificationDefinition(type).priority;
}

/**
 * Resolves default channels for a given NotificationType.
 */
export function getNotificationChannels(type: NotificationType): NotificationChannel[] {
  return getNotificationDefinition(type).defaultChannels;
}
