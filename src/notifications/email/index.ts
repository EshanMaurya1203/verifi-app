/**
 * Barrel export for src/lib/email.
 *
 * Consumers import from `@/lib/email` and get everything they need:
 *   - `sendEmail()`   — the only function needed to send emails
 *   - Types           — for building template payloads
 *   - `getResendClient()` — rarely needed directly, but available
 */

export { sendEmail } from "./sendEmail";
export { getResendClient } from "./resend";

export type {
  SendEmailOptions,
  SendEmailResult,
  EmailSuccessResult,
  EmailErrorResult,
  EmailErrorCode,
  EmailTemplate,
  EmailTemplateName,
  WelcomeEmailProps,
  VerificationCompletedEmailProps,
  VerificationFailedEmailProps,
} from "./types";
