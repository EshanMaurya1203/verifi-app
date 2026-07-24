/**
 * Fully resolved business events for the notification system.
 * 
 * Business logic must construct these payloads with all necessary data.
 * The notification layer will NEVER query the database or external services.
 */

import type { NotificationType } from "./types";

export interface WelcomePayload {
  founderName?: string;
  startupName?: string;
  email: string;
  dashboardUrl: string;
  verificationUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface VerificationCompletedPayload {
  founderName: string;
  startupName: string;
  email: string;
  verificationScore: number;
  profileUrl: string;
}

export interface VerificationFailedPayload {
  founderName: string;
  startupName: string;
  email: string;
  failureReason: string;
  retryUrl: string;
}

export interface ProviderConnectedPayload {
  founderName?: string;
  startupName?: string;
  email: string;
  providerName: string;
  providerDisplayName: string;
  connectionTimestamp?: string | Date;
  dashboardUrl: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface ProviderSyncFailedPayload {
  founderName?: string;
  startupName?: string;
  email: string;
  providerName: string;
  providerDisplayName: string;
  failureReason: string;
  dashboardUrl: string;
  reconnectUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface AccountDeletedPayload {
  founderName?: string;
  email: string;
  startupName?: string;
  feedbackUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface GenericNotificationPayload {
  email: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Standard notification sources for context and telemetry.
 */
export type NotificationSource =
  | "AUTH"
  | "ONBOARDING"
  | "VERIFICATION"
  | "ADMIN"
  | "WEBHOOK"
  | "CRON"
  | "QUEUE"
  | (string & {});

/**
 * Reusable production-grade metadata required for every notification event.
 */
export interface NotificationMetadata {
  eventId: string;
  occurredAt: Date;
  source: NotificationSource;
  version: number;
  correlationId?: string;
  idempotencyKey?: string;
}

/**
 * Base fields required by all notification events.
 */
export interface BaseNotificationEvent {
  metadata: NotificationMetadata;
  /** Backwards compatibility accessor */
  idempotencyKey?: string;
  /** Backwards compatibility accessor */
  correlationId?: string;
}

/**
 * Discriminated union of all possible business events that can trigger notifications.
 */
export type NotificationEvent = BaseNotificationEvent & (
  | { type: "WELCOME"; payload: WelcomePayload }
  | { type: "VERIFICATION_COMPLETED"; payload: VerificationCompletedPayload }
  | { type: "VERIFICATION_FAILED"; payload: VerificationFailedPayload }
  | { type: "PROVIDER_CONNECTED"; payload: ProviderConnectedPayload }
  | { type: "PROVIDER_SYNC_FAILED"; payload: ProviderSyncFailedPayload }
  | { type: "ACCOUNT_DELETED"; payload: AccountDeletedPayload }
  | { type: "REVENUE_SYNC_REMINDER"; payload: GenericNotificationPayload }
  | { type: "TRIAL_EXPIRING"; payload: GenericNotificationPayload }
  | { type: "PLAN_EXPIRED"; payload: GenericNotificationPayload }
  | { type: "PAYMENT_FAILED"; payload: GenericNotificationPayload }
  | { type: "SUBSCRIPTION_RENEWED"; payload: GenericNotificationPayload }
  | { type: "TRUST_SCORE_CHANGED"; payload: GenericNotificationPayload }
  | { type: "LEADERBOARD_CHANGED"; payload: GenericNotificationPayload }
  | { type: "SECURITY_ALERT"; payload: GenericNotificationPayload }
  | { type: "PRODUCT_UPDATE"; payload: GenericNotificationPayload }
  | { type: "FEATURE_ANNOUNCEMENT"; payload: GenericNotificationPayload }
);

export type NotificationEventType = NotificationType;
