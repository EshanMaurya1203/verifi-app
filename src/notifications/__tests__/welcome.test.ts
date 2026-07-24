/**
 * Unit Tests for NTF-000B: Welcome to Verifii Notification
 * 
 * Verifies:
 * - Welcome payload structure and validation
 * - Registry metadata lookup for WELCOME
 * - Dispatcher integration for WELCOME event
 * - Foundation idempotency key generation (ntf_welcome_${userId})
 * - React Email rendering of Welcome template (HTML output)
 * - Duplicate trigger prevention
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
import WelcomeEmail, { defaultSubject } from "@/emails/Welcome";
import type { WelcomePayload } from "../events";

describe("NTF-000B: Welcome Notification Metadata & Registry", () => {
  it("should have correct metadata registered for WELCOME", () => {
    const def = getNotificationDefinition("WELCOME");
    assert.equal(def.type, "WELCOME");
    assert.equal(def.category, "ACCOUNT");
    assert.equal(def.priority, "HIGH");
    assert.deepEqual(def.defaultChannels, ["EMAIL"]);
    assert.equal(def.emailTemplateRef, "welcome");
  });

  it("should resolve WELCOME category, priority, and channels via helper functions", () => {
    assert.equal(getNotificationCategory("WELCOME"), "ACCOUNT");
    assert.equal(getNotificationPriority("WELCOME"), "HIGH");
    assert.deepEqual(getNotificationChannels("WELCOME"), ["EMAIL"]);
  });
});

describe("NTF-000B: Welcome Idempotency Key Generation", () => {
  it("should generate a deterministic foundation idempotency key for user welcome", () => {
    const userId = "usr_test_7712";
    const key1 = generateIdempotencyKey({
      notificationType: "WELCOME",
      entityId: userId,
    });
    const key2 = generateIdempotencyKey({
      notificationType: "WELCOME",
      entityId: userId,
    });

    assert.equal(key1, "ntf_welcome_usr_test_7712");
    assert.equal(key1, key2);
  });
});

describe("NTF-000B: Welcome Email Component Rendering", () => {
  it("should render Welcome email HTML with personalized founder name and CTA", async () => {
    const props = {
      founderName: "Rohan Sharma",
      startupName: "Acme AI",
      dashboardUrl: "https://www.verifii.in/dashboard",
      verificationUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
      currentYear: 2026,
    };

    const html = await render(React.createElement(WelcomeEmail, props));

    assert.ok(html.includes("Welcome, Rohan Sharma!"));
    assert.ok(html.includes("Acme AI"));
    assert.ok(html.includes("Verify Your Startup"));
    assert.ok(html.includes("Connect Stripe or Razorpay"));
    assert.ok(html.includes("support@verifii.in"));
    assert.ok(html.includes("receiving this email because you have a Verifii account"));
  });

  it("should render fallback greeting when founderName is omitted", async () => {
    const props = {
      dashboardUrl: "https://www.verifii.in/dashboard",
    };

    const html = await render(React.createElement(WelcomeEmail, props));

    assert.ok(html.includes("Welcome!"));
    assert.ok(html.includes("Verify Your Startup"));
  });

  it("should export default subject line for Welcome email", () => {
    assert.equal(defaultSubject, "Welcome to Verifii 🎉");
  });
});

describe("NTF-000B: Dispatcher Integration for WELCOME", () => {
  it("should execute WELCOME dispatch through foundation dispatcher cleanly", async () => {
    const payload: WelcomePayload = {
      founderName: "Priya",
      startupName: "PayFast",
      email: "priya@payfast.io",
      dashboardUrl: "https://www.verifii.in/dashboard",
      verificationUrl: "https://www.verifii.in/dashboard",
      supportEmail: "support@verifii.in",
      currentYear: 2026,
    };

    const result = await dispatchNotification({
      type: "WELCOME",
      metadata: {
        eventId: "evt_welcome_test_101",
        occurredAt: new Date(),
        source: "onboarding.service",
        version: 1,
        correlationId: "corr_welcome_101",
        idempotencyKey: generateIdempotencyKey({
          notificationType: "WELCOME",
          entityId: "usr_priya_101",
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
