/**
 * Unit Tests for NTF-003: Account Deleted Notification
 *
 * Verifies:
 * - Metadata & Registry resolution for ACCOUNT_DELETED
 * - Idempotency key generation (ntf_account_deleted_account_${userId})
 * - React Email rendering of AccountDeleted template
 * - Dispatcher integration for ACCOUNT_DELETED
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
import AccountDeletedEmail, { defaultSubject } from "@/emails/AccountDeleted";
import type { AccountDeletedPayload } from "../events";

describe("NTF-003: Account Deleted Metadata & Registry", () => {
  it("should have correct metadata registered for ACCOUNT_DELETED", () => {
    const def = getNotificationDefinition("ACCOUNT_DELETED");
    assert.equal(def.type, "ACCOUNT_DELETED");
    assert.equal(def.category, "ACCOUNT");
    assert.equal(def.priority, "HIGH");
    assert.deepEqual(def.defaultChannels, ["EMAIL"]);
    assert.equal(def.emailTemplateRef, "account-deleted");
  });

  it("should resolve ACCOUNT_DELETED category, priority, and channels via helper functions", () => {
    assert.equal(getNotificationCategory("ACCOUNT_DELETED"), "ACCOUNT");
    assert.equal(getNotificationPriority("ACCOUNT_DELETED"), "HIGH");
    assert.deepEqual(getNotificationChannels("ACCOUNT_DELETED"), ["EMAIL"]);
  });
});

describe("NTF-003: Account Deleted Idempotency Key Generation", () => {
  it("should generate a deterministic idempotency key for account deletion", () => {
    const userId = "usr_abc123";
    const key = generateIdempotencyKey({
      notificationType: "ACCOUNT_DELETED",
      entityId: userId,
      scope: "account",
    });
    assert.equal(key, "ntf_account_deleted_account_usr_abc123");
  });

  it("should produce different keys for different user IDs", () => {
    const key1 = generateIdempotencyKey({
      notificationType: "ACCOUNT_DELETED",
      entityId: "usr_abc123",
      scope: "account",
    });
    const key2 = generateIdempotencyKey({
      notificationType: "ACCOUNT_DELETED",
      entityId: "usr_def456",
      scope: "account",
    });
    assert.notEqual(key1, key2);
  });
});

describe("NTF-003: Account Deleted Email Component Rendering", () => {
  it("should render AccountDeleted email HTML with personalized goodbye and data purge confirmation", async () => {
    const props = {
      founderName: "Aarav",
      startupName: "Nexus Labs",
      supportEmail: "support@verifii.in",
    };

    const html = await render(React.createElement(AccountDeletedEmail, props));

    assert.ok(html.includes("Goodbye, Aarav"));
    assert.ok(html.includes("Nexus Labs"));
    assert.ok(html.includes("permanently deleted"));
    assert.ok(html.includes("support@verifii.in"));
  });

  it("should render fallback greeting when founderName is omitted", async () => {
    const props = {
      supportEmail: "support@verifii.in",
    };

    const html = await render(React.createElement(AccountDeletedEmail, props));

    assert.ok(html.includes("Goodbye"));
    assert.ok(!html.includes("Goodbye, "));
    assert.ok(html.includes("permanently deleted"));
  });

  it("should export default subject line for Account Deleted email", () => {
    assert.equal(defaultSubject, "Your Verifii Account Has Been Deleted");
  });
});

describe("NTF-003: Dispatcher Integration for ACCOUNT_DELETED", () => {
  it("should execute ACCOUNT_DELETED dispatch through foundation dispatcher cleanly", async () => {
    const payload: AccountDeletedPayload = {
      founderName: "Aarav",
      email: "aarav@nexuslabs.io",
      startupName: "Nexus Labs",
      feedbackUrl: "https://www.verifii.in/feedback",
      supportEmail: "support@verifii.in",
      currentYear: 2026,
    };

    const result = await dispatchNotification({
      type: "ACCOUNT_DELETED",
      metadata: {
        eventId: "evt_acct_deleted_401",
        occurredAt: new Date(),
        source: "account.deletion.handler",
        version: 1,
        correlationId: "corr_acct_deleted_401",
        idempotencyKey: generateIdempotencyKey({
          notificationType: "ACCOUNT_DELETED",
          entityId: "usr_abc123",
          scope: "account",
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
