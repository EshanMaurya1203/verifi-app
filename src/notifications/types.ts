/**
 * Core types for the Verifii Notification Domain Foundation (NTF-000A).
 * 
 * Defines notification types, categories, priorities, multi-channel capabilities,
 * and base notification envelopes.
 */

import type { NotificationEvent } from "./events";

/**
 * All supported notification types across Verifii platform.
 */
export type NotificationType =
  | "WELCOME"
  | "PROVIDER_CONNECTED"
  | "PROVIDER_SYNC_FAILED"
  | "ACCOUNT_DELETED"
  | "REVENUE_SYNC_REMINDER"
  | "TRIAL_EXPIRING"
  | "PLAN_EXPIRED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_CANCELLED"
  | "TRUST_SCORE_CHANGED"
  | "LEADERBOARD_CHANGED"
  | "SECURITY_ALERT"
  | "PRODUCT_UPDATE"
  | "FEATURE_ANNOUNCEMENT"
  | "VERIFICATION_COMPLETED"
  | "VERIFICATION_FAILED"
  | "PRODUCTION_EMAIL_TEST";

/**
 * Standard notification categories.
 * Every notification type belongs to exactly one category.
 */
export type NotificationCategory =
  | "ACCOUNT"
  | "VERIFICATION"
  | "BILLING"
  | "SECURITY"
  | "GROWTH"
  | "PRODUCT"
  | "SYSTEM";

/**
 * Standard notification delivery priority levels.
 */
export type NotificationPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "CRITICAL";

/**
 * Available delivery channels. Designed for multi-channel expansion.
 * Today: EMAIL adapter implemented.
 * Future: IN_APP, PUSH, SLACK, DISCORD, WEBHOOK, SMS adapters.
 */
export type NotificationChannel =
  | "EMAIL"
  | "IN_APP"
  | "PUSH"
  | "SLACK"
  | "DISCORD"
  | "WEBHOOK"
  | "SMS";

/**
 * Definition metadata stored in the Centralized Notification Registry.
 */
export interface NotificationMetadataDefinition {
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  defaultChannels: NotificationChannel[];
  emailTemplateRef?: string;
  inAppTemplateRef?: string;
  pushTemplateRef?: string;
}

/**
 * Shared notification envelope contract.
 */
export interface NotificationEnvelope<
  TType extends NotificationType = NotificationType,
  TPayload = unknown
> {
  id: string;
  type: TType;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  recipientUserId: string;
  startupId?: number;
  idempotencyKey: string;
  timestamp: Date;
  payload: TPayload;
}

/**
 * Standardized result from any delivery adapter.
 */
export type DeliveryErrorCode = "RENDER_FAILURE" | "SEND_FAILURE" | "UNKNOWN" | "MISSING_CONFIG";

export interface DeliverySuccessResult {
  success: true;
  messageId?: string;
}

export interface DeliveryErrorResult {
  success: false;
  code: DeliveryErrorCode;
  error: string;
  retryable: boolean;
}

export type DeliveryResult = DeliverySuccessResult | DeliveryErrorResult;

export interface ChannelDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  retryable: boolean;
  providerMessageId?: string;
  error?: string;
  durationMs: number;
}

export type DispatchNotificationResult = {
  success: boolean;
  channels: ChannelDeliveryResult[];
};

/**
 * Interface that all channel delivery adapters must implement.
 */
export interface DeliveryAdapter {
  /**
   * The channel this adapter handles.
   */
  channel: NotificationChannel;

  /**
   * Delivers the event via this channel.
   * Resolves to a DeliveryResult.
   */
  deliver(event: NotificationEvent): Promise<DeliveryResult>;
}
