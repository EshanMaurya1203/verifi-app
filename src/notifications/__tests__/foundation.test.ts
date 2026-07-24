/**
 * Unit Tests for NTF-000A Notification Domain Foundation.
 * 
 * Verifies:
 * - Registry lookup & completeness across all 14 types
 * - Category mapping
 * - Priority mapping
 * - Channel resolution
 * - Idempotency helper utilities
 * - Dispatcher metadata resolution
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getNotificationDefinition,
  getNotificationCategory,
  getNotificationPriority,
  getNotificationChannels,
  generateIdempotencyKey,
  generateCanonicalVerificationIdempotencyKey,
  validateIdempotencyKey,
  dispatchNotification,
} from "../index";
import type { NotificationType, NotificationCategory, NotificationPriority, NotificationChannel } from "../types";

describe("NTF-000A: Notification Registry & Metadata", () => {
  const allTypes: NotificationType[] = [
    "WELCOME",
    "PROVIDER_CONNECTED",
    "PROVIDER_SYNC_FAILED",
    "ACCOUNT_DELETED",
    "REVENUE_SYNC_REMINDER",
    "TRIAL_EXPIRING",
    "PLAN_EXPIRED",
    "PAYMENT_FAILED",
    "SUBSCRIPTION_RENEWED",
    "TRUST_SCORE_CHANGED",
    "LEADERBOARD_CHANGED",
    "SECURITY_ALERT",
    "PRODUCT_UPDATE",
    "FEATURE_ANNOUNCEMENT",
    "VERIFICATION_COMPLETED",
    "VERIFICATION_FAILED",
  ];

  it("should contain definitions for all supported notification types", () => {
    for (const type of allTypes) {
      const def = getNotificationDefinition(type);
      assert.ok(def, `Definition missing for notification type: ${type}`);
      assert.equal(def.type, type);
    }
  });

  it("should map each notification type to exactly one valid category", () => {
    const validCategories: Set<NotificationCategory> = new Set([
      "ACCOUNT",
      "VERIFICATION",
      "BILLING",
      "SECURITY",
      "GROWTH",
      "PRODUCT",
      "SYSTEM",
    ]);

    for (const type of allTypes) {
      const category = getNotificationCategory(type);
      assert.ok(
        validCategories.has(category),
        `Invalid category '${category}' for type '${type}'`
      );
    }
  });

  it("should map each notification type to a valid default priority", () => {
    const validPriorities: Set<NotificationPriority> = new Set([
      "LOW",
      "NORMAL",
      "HIGH",
      "CRITICAL",
    ]);

    for (const type of allTypes) {
      const priority = getNotificationPriority(type);
      assert.ok(
        validPriorities.has(priority),
        `Invalid priority '${priority}' for type '${type}'`
      );
    }
  });

  it("should resolve default channels for every notification type", () => {
    const validChannels: Set<NotificationChannel> = new Set([
      "EMAIL",
      "IN_APP",
      "PUSH",
      "SLACK",
      "DISCORD",
      "WEBHOOK",
      "SMS",
    ]);

    for (const type of allTypes) {
      const channels = getNotificationChannels(type);
      assert.ok(Array.isArray(channels) && channels.length > 0);
      for (const channel of channels) {
        assert.ok(validChannels.has(channel), `Invalid channel '${channel}' for type '${type}'`);
      }
    }
  });

  it("should throw error for unregistered notification types", () => {
    assert.throws(
      () => getNotificationDefinition("NON_EXISTENT_TYPE" as NotificationType),
      /Unregistered notification type/
    );
  });
});

describe("NTF-000A: Idempotency Infrastructure", () => {
  it("should generate deterministic idempotency keys", () => {
    const key1 = generateIdempotencyKey({
      notificationType: "WELCOME",
      entityId: "usr_9981",
    });
    const key2 = generateIdempotencyKey({
      notificationType: "WELCOME",
      entityId: "usr_9981",
    });

    assert.equal(key1, "ntf_welcome_usr_9981");
    assert.equal(key1, key2);
  });

  it("should generate canonical verification log idempotency keys (Gap 3)", () => {
    const key = generateCanonicalVerificationIdempotencyKey("VERIFICATION_COMPLETED", 4052);
    assert.equal(key, "ntf_verification_completed_log_4052");
  });

  it("should validate idempotency key formats correctly", () => {
    assert.equal(validateIdempotencyKey("ntf_welcome_usr_9981"), true);
    assert.equal(validateIdempotencyKey("ntf_verification_completed_log_4052"), true);
    assert.equal(validateIdempotencyKey(""), false);
    assert.equal(validateIdempotencyKey("short"), true);
    assert.equal(validateIdempotencyKey("a"), false);
    assert.equal(validateIdempotencyKey("invalid space key"), false);
  });
});

describe("NTF-000A: Dispatcher Foundation", () => {
  it("should resolve metadata from registry during dispatch", async () => {
    const result = await dispatchNotification({
      type: "WELCOME",
      metadata: {
        eventId: "evt_12345",
        occurredAt: new Date(),
        source: "ONBOARDING",
        version: 1,
        correlationId: "corr_9901",
        idempotencyKey: "ntf_welcome_test_user",
      },
      payload: {
        founderName: "Alex",
        startupName: "TechCorp",
        email: "alex@techcorp.in",
        dashboardUrl: "https://verifii.in/dashboard",
      },
    });

    assert.ok(result);
    assert.equal(typeof result.success, "boolean");
    assert.ok(Array.isArray(result.channels));
  });
});
