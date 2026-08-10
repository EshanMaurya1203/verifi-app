/**
 * Central email dispatch for Verifii.
 *
 * Every email sent from the application flows through this single
 * function. It:
 *   1. Resolves the correct React Email component from the template name.
 *   2. Renders to HTML + auto-generated plain-text fallback.
 *   3. Sends via the singleton Resend client.
 *   4. Returns a typed result discriminated by `success`.
 *
 * Callers never need to touch Resend or rendering directly.
 */

import * as React from "react";
import { render } from "@react-email/render";

import { defaultEmailProvider } from "./resend";
import { logger, LogEvent } from "@/lib/logger";
import type {
  SendEmailOptions,
  SendEmailResult,
  EmailTemplate,
  EmailProvider,
} from "./types";
import { emailBrandConfig } from "@/lib/branding";

// ── Template Imports ──────────────────────────────────────────────────────

import WelcomeEmail, {
  defaultSubject as welcomeSubject,
} from "@/emails/Welcome";

import ProviderConnectedEmail, {
  defaultSubject as providerConnectedSubject,
} from "@/emails/ProviderConnected";

import ProviderSyncFailedEmail, {
  defaultSubject as providerSyncFailedSubject,
} from "@/emails/ProviderSyncFailed";

import AccountDeletedEmail, {
  defaultSubject as accountDeletedSubject,
} from "@/emails/AccountDeleted";

import VerificationCompletedEmail, {
  defaultSubject as verificationCompletedSubject,
} from "@/emails/VerificationCompleted";

import VerificationFailedEmail, {
  defaultSubject as verificationFailedSubject,
} from "@/emails/VerificationFailed";

import SubscriptionActivatedEmail, {
  defaultSubject as subscriptionActivatedSubject,
} from "@/emails/SubscriptionActivated";

import SubscriptionRenewedEmail, {
  defaultSubject as subscriptionRenewedSubject,
} from "@/emails/SubscriptionRenewed";

import TrialExpiringEmail, {
  defaultSubject as trialExpiringSubject,
} from "@/emails/TrialExpiring";

import PaymentFailedEmail, {
  defaultSubject as paymentFailedSubject,
} from "@/emails/PaymentFailed";

import SubscriptionCancelledEmail, {
  defaultSubject as subscriptionCancelledSubject,
} from "@/emails/SubscriptionCancelled";

import ProductionEmailTestEmail, {
  defaultSubject as productionEmailTestSubject,
} from "@/emails/ProductionEmailTest";

// ── Email Constants ────────────────────────────────────────────────────────

const FROM_ADDRESS = emailBrandConfig.fromAddress;

// ── Template Resolution ────────────────────────────────────────────────────

interface ResolvedTemplate {
  element: React.ReactElement;
  subject: string;
}

/**
 * Maps a discriminated `EmailTemplate` union to its rendered React
 * element and default subject line.
 *
 * To add a new template:
 *   1. Add the type to `EmailTemplate` in `types.ts`.
 *   2. Create the component in `src/emails/`.
 *   3. Add a `case` branch here.
 */
function resolveTemplate(template: EmailTemplate): ResolvedTemplate {
  switch (template.type) {
    case "welcome":
      return {
        element: React.createElement(WelcomeEmail, template.props),
        subject: welcomeSubject,
      };

    case "provider-connected":
      return {
        element: React.createElement(ProviderConnectedEmail, template.props),
        subject: providerConnectedSubject,
      };

    case "provider-sync-failed":
      return {
        element: React.createElement(ProviderSyncFailedEmail, template.props),
        subject: providerSyncFailedSubject,
      };

    case "account-deleted":
      return {
        element: React.createElement(AccountDeletedEmail, template.props),
        subject: accountDeletedSubject,
      };

    case "verification-completed":
      return {
        element: React.createElement(
          VerificationCompletedEmail,
          template.props
        ),
        subject: verificationCompletedSubject,
      };

    case "verification-failed":
      return {
        element: React.createElement(VerificationFailedEmail, template.props),
        subject: verificationFailedSubject,
      };

    case "subscription-activated":
      return {
        element: React.createElement(SubscriptionActivatedEmail, template.props),
        subject: subscriptionActivatedSubject,
      };

    case "subscription-renewed":
      return {
        element: React.createElement(SubscriptionRenewedEmail, template.props),
        subject: subscriptionRenewedSubject,
      };

    case "trial-expiring":
      return {
        element: React.createElement(TrialExpiringEmail, template.props),
        subject: trialExpiringSubject,
      };

    case "payment-failed":
      return {
        element: React.createElement(PaymentFailedEmail, template.props),
        subject: paymentFailedSubject,
      };

    case "subscription-cancelled":
      return {
        element: React.createElement(SubscriptionCancelledEmail, template.props),
        subject: subscriptionCancelledSubject,
      };

    case "production-email-test":
      return {
        element: React.createElement(ProductionEmailTestEmail, template.props),
        subject: productionEmailTestSubject,
      };

    default: {
      // Exhaustiveness check — TypeScript will error if a template
      // type is added to the union but not handled here.
      const _exhaustive: never = template;
      throw new Error(
        `[Verifii Email] Unhandled template type: ${JSON.stringify(_exhaustive)}`
      );
    }
  }
}

// ── Plain-Text Fallback ────────────────────────────────────────────────────

/**
 * Strips HTML tags and normalises whitespace to produce a readable
 * plain-text fallback from rendered HTML.
 *
 * We deliberately avoid pulling in a heavy dependency like `html-to-text`
 * — this covers 95%+ of transactional emails where the content is simple
 * paragraphs and links.
 */
function htmlToPlainText(html: string): string {
  return html
    // Remove style / script blocks entirely
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Convert <br> and closing block tags to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    // Convert links to "text (url)" format
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse excessive whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a transactional email using a pre-defined template.
 *
 * @example
 * ```ts
 * const result = await sendEmail({
 *   to: "founder@example.com",
 *   template: {
 *     type: "welcome",
 *     props: {
 *       founderName: "Eshan",
 *       startupName: "Acme Corp",
 *       dashboardUrl: "https://www.verifii.in/dashboard",
 *     },
 *   },
 * });
 *
 * if (result.success) {
 *   console.log("Sent:", result.messageId);
 * }
 * ```
 */
export async function sendEmail(
  options: SendEmailOptions,
  provider: EmailProvider = defaultEmailProvider
): Promise<SendEmailResult> {
  const { to, template, subject: subjectOverride, replyTo, idempotencyKey } = options;

  // ── 1. Resolve template ──────────────────────────────────────────────
  let resolved: ResolvedTemplate;

  try {
    resolved = resolveTemplate(template);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown resolve error";

    logger.error("[Email] Template resolution failed", {
      event: LogEvent.EMAIL_DELIVERY_FAILED,
      error: message,
      message: `template=${template.type}`,
    });

    return { success: false, code: "RENDER_FAILURE", error: message };
  }

  // ── 2. Render to HTML ────────────────────────────────────────────────
  let html: string;
  let text: string;

  try {
    html = await render(resolved.element);
    text = htmlToPlainText(html);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown render error";

    logger.error("[Email] React Email render failed", {
      event: LogEvent.EMAIL_DELIVERY_FAILED,
      error: message,
      message: `template=${template.type}`,
    });

    return { success: false, code: "RENDER_FAILURE", error: message };
  }

  // ── 3. Send via Provider Abstraction ─────────────────────────────────
  try {
    const result = await provider.send({
      from: FROM_ADDRESS,
      to,
      subject: subjectOverride ?? resolved.subject,
      html,
      text,
      replyTo,
      idempotencyKey,
    });

    if (!result.success) {
      logger.error("[Email] Provider transmission error", {
        event: LogEvent.EMAIL_DELIVERY_FAILED,
        error: result.error,
        message: `to=${to} template=${template.type}`,
      });

      return result;
    }

    logger.info("[Email] Sent successfully", {
      event: LogEvent.EMAIL_DELIVERY_COMPLETED,
      message: `id=${result.messageId} to=${to} template=${template.type}`,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown send error";

    logger.error("[Email] Unexpected send failure", {
      event: LogEvent.EMAIL_DELIVERY_FAILED,
      error: message,
      message: `to=${to} template=${template.type}`,
    });

    return { success: false, code: "UNKNOWN", error: message };
  }
}
