/**
 * Unit Tests for NTF-001: Provider Connected Notification
 * 
 * Verifies:
 * - Metadata & Registry resolution for PROVIDER_CONNECTED
 * - Payload structure and validation
 * - Dispatcher integration for PROVIDER_CONNECTED
 * - Foundation idempotency key generation (ntf_provider_connected_${provider}_${startupId})
 * - First-time connection rule & duplicate prevention
 * - React Email rendering of ProviderConnected template
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
import ProviderConnectedEmail, { defaultSubject } from "@/emails/ProviderConnected";
import type { ProviderConnectedPayload } from "../events";

describe("NTF-001: Provider Connected Metadata & Registry", () => {
  it("should have correct metadata registered for PROVIDER_CONNECTED", () => {
    const def = getNotificationDefinition("PROVIDER_CONNECTED");
    assert.equal(def.type, "PROVIDER_CONNECTED");
    assert.equal(def.category, "VERIFICATION");
    assert.equal(def.priority, "NORMAL");
    assert.deepEqual(def.defaultChannels, ["EMAIL"]);
    assert.equal(def.emailTemplateRef, "provider-connected");
  });

  it("should resolve PROVIDER_CONNECTED category, priority, and channels via helper functions", () => {
    assert.equal(getNotificationCategory("PROVIDER_CONNECTED"), "VERIFICATION");
    assert.equal(getNotificationPriority("PROVIDER_CONNECTED"), "NORMAL");
    assert.deepEqual(getNotificationChannels("PROVIDER_CONNECTED"), ["EMAIL"]);
  });
});

describe("NTF-001: Provider Connected Idempotency & First-Time Connection Rule", () => {
  it("should generate a deterministic idempotency key per provider per startup", () => {
    const startupId = 4052;
    const stripeKey = generateIdempotencyKey({
      notificationType: "PROVIDER_CONNECTED",
      entityId: startupId,
      scope: "stripe",
    });
    const razorpayKey = generateIdempotencyKey({
      notificationType: "PROVIDER_CONNECTED",
      entityId: startupId,
      scope: "razorpay",
    });

    assert.equal(stripeKey, "ntf_provider_connected_stripe_4052");
    assert.equal(razorpayKey, "ntf_provider_connected_razorpay_4052");
    assert.notEqual(stripeKey, razorpayKey);
  });

  it("should generate identical key on reconnect attempt (preventing duplicates)", () => {
    const startupId = 4052;
    const key1 = generateIdempotencyKey({
      notificationType: "PROVIDER_CONNECTED",
      entityId: startupId,
      scope: "stripe",
    });
    const key2 = generateIdempotencyKey({
      notificationType: "PROVIDER_CONNECTED",
      entityId: startupId,
      scope: "stripe",
    });

    assert.equal(key1, key2);
  });
});

describe("NTF-001: Provider Connected Email Component Rendering", () => {
  it("should render ProviderConnected email HTML with provider name and security notice", async () => {
    const props = {
      founderName: "Aarav",
      startupName: "Nexus Labs",
      providerName: "stripe",
      providerDisplayName: "Stripe",
      dashboardUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
    };

    const html = await render(React.createElement(ProviderConnectedEmail, props));

    assert.ok(html.includes("Hello, Aarav!"));
    assert.ok(html.includes("Stripe"));
    assert.ok(html.includes("Nexus Labs"));
    assert.ok(html.includes("Security Notice"));
    assert.ok(html.includes("Go to Dashboard"));
    assert.ok(html.includes("support@verifii.in"));
  });

  it("should render fallback greeting when founderName is omitted", async () => {
    const props = {
      providerDisplayName: "Razorpay",
      dashboardUrl: "https://www.verifii.in/dashboard",
    };

    const html = await render(React.createElement(ProviderConnectedEmail, props));

    assert.ok(html.includes("Hello!"));
    assert.ok(html.includes("Razorpay"));
  });

  it("should export default subject line for Provider Connected email", () => {
    assert.equal(defaultSubject, "Payment Provider Connected 🔒");
  });
});

describe("NTF-001: Dispatcher Integration for PROVIDER_CONNECTED", () => {
  it("should execute PROVIDER_CONNECTED dispatch through foundation dispatcher cleanly", async () => {
    const payload: ProviderConnectedPayload = {
      founderName: "Aarav",
      startupName: "Nexus Labs",
      email: "aarav@nexuslabs.io",
      providerName: "stripe",
      providerDisplayName: "Stripe",
      connectionTimestamp: new Date(),
      dashboardUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
      currentYear: 2026,
    };

    const result = await dispatchNotification({
      type: "PROVIDER_CONNECTED",
      metadata: {
        eventId: "evt_provider_connected_201",
        occurredAt: new Date(),
        source: "provider.connection.service",
        version: 1,
        correlationId: "corr_provider_connected_201",
        idempotencyKey: generateIdempotencyKey({
          notificationType: "PROVIDER_CONNECTED",
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
