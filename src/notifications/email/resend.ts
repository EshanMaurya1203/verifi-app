/**
 * Singleton Resend client for Verifii.
 *
 * This module lazily initializes a single Resend instance on first access.
 * All server-side code should import `getResendClient()` instead of
 * instantiating `new Resend(...)` directly.
 *
 * Why a getter instead of a top-level export?
 *   - Avoids client-side import errors (env var is server-only).
 *   - Allows us to validate the API key at call-time with a clear error.
 *   - Keeps the instance truly lazy — zero cost if no email is sent.
 */

import { Resend } from "resend";

let _client: Resend | null = null;

/**
 * Returns the shared Resend client instance.
 *
 * @throws {Error} if `RESEND_API_KEY` is not set in the environment.
 */
export function getResendClient(): Resend {
  if (_client) return _client;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "[Verifii Email] RESEND_API_KEY is not configured. " +
        "Add it to your .env.local file."
    );
  }

  _client = new Resend(apiKey);
  return _client;
}

import type { EmailProvider, EmailPayload, SendEmailResult } from "./types";

/**
 * Concrete implementation of EmailProvider using the Resend SDK.
 */
export class ResendProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<SendEmailResult> {
    try {
      const resend = getResendClient();

      const { data, error } = await resend.emails.send({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        headers: payload.idempotencyKey
          ? { "X-Entity-Ref-ID": payload.idempotencyKey }
          : undefined,
      });

      if (error || !data?.id) {
        const errorMessage = error?.message ?? "No message ID returned";
        return { success: false, code: "SEND_FAILURE", error: errorMessage };
      }

      return { success: true, messageId: data.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown send error";
      return { success: false, code: "UNKNOWN", error: message };
    }
  }
}

export const defaultEmailProvider: EmailProvider = new ResendProvider();
