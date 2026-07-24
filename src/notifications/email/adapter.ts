import type { DeliveryAdapter, DeliveryResult } from "../types";
import type { NotificationEvent } from "../events";
import { sendEmail } from "./sendEmail";
import type { EmailTemplate } from "./types";

/**
 * Adapter that connects the generic Notification Layer to the Email Infrastructure.
 * 
 * Maps fully resolved business events to email templates.
 */
export const emailAdapter: DeliveryAdapter = {
  channel: "EMAIL",
  async deliver(event: NotificationEvent): Promise<DeliveryResult> {
    let template: EmailTemplate;
    let to: string;

    switch (event.type) {
      case "WELCOME":
        to = event.payload.email;
        template = {
          type: "welcome",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            dashboardUrl: event.payload.dashboardUrl,
            verificationUrl: event.payload.verificationUrl,
            supportEmail: event.payload.supportEmail,
            currentYear: event.payload.currentYear,
          },
        };
        break;

      case "PROVIDER_CONNECTED":
        to = event.payload.email;
        template = {
          type: "provider-connected",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            providerName: event.payload.providerName,
            providerDisplayName: event.payload.providerDisplayName,
            connectionTimestamp: event.payload.connectionTimestamp,
            dashboardUrl: event.payload.dashboardUrl,
            supportEmail: event.payload.supportEmail,
            currentYear: event.payload.currentYear,
          },
        };
        break;

      case "PROVIDER_SYNC_FAILED":
        to = event.payload.email;
        template = {
          type: "provider-sync-failed",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            providerName: event.payload.providerName,
            providerDisplayName: event.payload.providerDisplayName,
            failureReason: event.payload.failureReason,
            dashboardUrl: event.payload.dashboardUrl,
            reconnectUrl: event.payload.reconnectUrl,
            supportEmail: event.payload.supportEmail,
            currentYear: event.payload.currentYear,
          },
        };
        break;

      case "ACCOUNT_DELETED":
        to = event.payload.email;
        template = {
          type: "account-deleted",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            feedbackUrl: event.payload.feedbackUrl,
            supportEmail: event.payload.supportEmail,
            currentYear: event.payload.currentYear,
          },
        };
        break;

      case "VERIFICATION_COMPLETED":
        to = event.payload.email;
        template = {
          type: "verification-completed",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            verificationScore: event.payload.verificationScore,
            profileUrl: event.payload.profileUrl,
          },
        };
        break;

      case "VERIFICATION_FAILED":
        to = event.payload.email;
        template = {
          type: "verification-failed",
          props: {
            founderName: event.payload.founderName,
            startupName: event.payload.startupName,
            failureReason: event.payload.failureReason,
            retryUrl: event.payload.retryUrl,
          },
        };
        break;

      default:
        return {
          success: false,
          code: "UNKNOWN",
          error: `Email adapter cannot handle event type: ${(event as { type: string }).type}`,
          retryable: false,
        };
    }

    const result = await sendEmail({
      to,
      template,
      idempotencyKey: event.metadata?.idempotencyKey ?? event.idempotencyKey,
    });

    if (result.success) {
      return { success: true, messageId: result.messageId };
    }

    // Map email-specific error code to generic delivery error code
    return {
      success: false,
      code: result.code === "MISSING_API_KEY" ? "MISSING_CONFIG" : result.code,
      error: result.error,
      retryable: result.code === "SEND_FAILURE" || result.code === "UNKNOWN",
    };
  },
};
