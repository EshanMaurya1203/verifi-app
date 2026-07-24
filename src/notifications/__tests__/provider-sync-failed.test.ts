/**
 * Unit Tests for NTF-002: Provider Sync Failed Notification
 * 
 * Verifies:
 * - Metadata & Registry resolution for PROVIDER_SYNC_FAILED
 * - Payload structure and validation
 * - Dispatcher integration for PROVIDER_SYNC_FAILED
 * - Foundation idempotency key generation (ntf_provider_sync_failed_${provider}_${startupId})
 * - Failure deduplication (identical keys generated on repeated failures)
 * - React Email rendering of ProviderSyncFailed template
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "@react-email/render";

import {
  getNotificationDefinition,
  getNotificationCategory,
  getNotificationPriority,
  getNotificationChannels,
  generateIdempotencyKey,
  dispatchNotification,
} from "../index";
import ProviderSyncFailedEmail, { defaultSubject } from "@/emails/ProviderSyncFailed";
import type { ProviderSyncFailedPayload } from "../events";

describe("NTF-002: Provider Sync Failed Metadata & Registry", () => {
  it("should have correct metadata registered for PROVIDER_SYNC_FAILED", () => {
    const def = getNotificationDefinition("PROVIDER_SYNC_FAILED");
    assert.equal(def.type, "PROVIDER_SYNC_FAILED");
    assert.equal(def.category, "VERIFICATION");
    assert.equal(def.priority, "HIGH");
    assert.deepEqual(def.defaultChannels, ["EMAIL"]);
    assert.equal(def.emailTemplateRef, "provider-sync-failed");
  });

  it("should resolve PROVIDER_SYNC_FAILED category, priority, and channels via helper functions", () => {
    assert.equal(getNotificationCategory("PROVIDER_SYNC_FAILED"), "VERIFICATION");
    assert.equal(getNotificationPriority("PROVIDER_SYNC_FAILED"), "HIGH");
    assert.deepEqual(getNotificationChannels("PROVIDER_SYNC_FAILED"), ["EMAIL"]);
  });
});

describe("NTF-002: Failure Deduplication & Idempotency Key Generation", () => {
  it("should generate a deterministic idempotency key for provider sync failure", () => {
    const startupId = 4052;
    const stripeKey = generateIdempotencyKey({
      notificationType: "PROVIDER_SYNC_FAILED",
      entityId: startupId,
      scope: "stripe",
    });
    const razorpayKey = generateIdempotencyKey({
      notificationType: "PROVIDER_SYNC_FAILED",
      entityId: startupId,
      scope: "razorpay",
    });

    assert.equal(stripeKey, "ntf_provider_sync_failed_stripe_4052");
    assert.equal(razorpayKey, "ntf_provider_sync_failed_razorpay_4052");
    assert.notEqual(stripeKey, razorpayKey);
  });

  it("should produce identical idempotency key on repeated sync failures (deduplication)", () => {
    const startupId = 4052;
    const keyAttempt1 = generateIdempotencyKey({
      notificationType: "PROVIDER_SYNC_FAILED",
      entityId: startupId,
      scope: "stripe",
    });
    const keyAttempt2 = generateIdempotencyKey({
      notificationType: "PROVIDER_SYNC_FAILED",
      entityId: startupId,
      scope: "stripe",
    });

    assert.equal(keyAttempt1, keyAttempt2);
  });
});

describe("NTF-002: Provider Sync Failed Email Component Rendering", () => {
  it("should render ProviderSyncFailed email HTML with user-friendly error and action steps", async () => {
    const props = {
      founderName: "Aarav",
      startupName: "Nexus Labs",
      providerName: "stripe",
      providerDisplayName: "Stripe",
      failureReason: "Live API key was revoked or expired.",
      dashboardUrl: "https://www.verifii.in/dashboard",
      reconnectUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
    };

    const html = await render(React.createElement(ProviderSyncFailedEmail, props));

    assert.ok(html.includes("Hello, Aarav!"));
    assert.ok(html.includes("Stripe"));
    assert.ok(html.includes("Nexus Labs"));
    assert.ok(html.includes("Live API key was revoked or expired."));
    assert.ok(html.includes("Reconnect Provider"));
    assert.ok(html.includes("support@verifii.in"));
  });

  it("should render fallback text when founderName and failureReason are omitted", async () => {
    const props = {
      providerDisplayName: "Razorpay",
      dashboardUrl: "https://www.verifii.in/dashboard",
    };

    const html = await render(React.createElement(ProviderSyncFailedEmail, props));

    assert.ok(html.includes("Hello!"));
    assert.ok(html.includes("Razorpay"));
    assert.ok(html.includes("Reconnect Provider"));
  });

  it("should export default subject line for Provider Sync Failed email", () => {
    assert.equal(defaultSubject, "Action Required: Payment Provider Sync Needs Attention ⚠️");
  });
});

describe("NTF-002: Dispatcher Integration for PROVIDER_SYNC_FAILED", () => {
  it("should execute PROVIDER_SYNC_FAILED dispatch through foundation dispatcher cleanly", async () => {
    const payload: ProviderSyncFailedPayload = {
      founderName: "Aarav",
      startupName: "Nexus Labs",
      email: "aarav@nexuslabs.io",
      providerName: "stripe",
      providerDisplayName: "Stripe",
      failureReason: "Stripe Live API access token expired.",
      dashboardUrl: "https://www.verifii.in/dashboard",
      reconnectUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
      currentYear: 2026,
    };

    const result = await dispatchNotification({
      type: "PROVIDER_SYNC_FAILED",
      metadata: {
        eventId: "evt_sync_failed_301",
        occurredAt: new Date(),
        source: "provider.sync.service",
        version: 1,
        correlationId: "corr_sync_failed_301",
        idempotencyKey: generateIdempotencyKey({
          notificationType: "PROVIDER_SYNC_FAILED",
          entityId: 4052,
          scope: "stripe",
        }),
      },
      payload,
    });

    assert.ok(result);
    assert.equal(typeof result.success, "boolean");
    assert.ok(result.channels.length > 0);
    assert.equal(result.channels[0].channel, "EMAIL");
  });
});
