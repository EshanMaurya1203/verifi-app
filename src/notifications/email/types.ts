/**
 * Email infrastructure types for Verifii.
 *
 * Defines a discriminated-union template system so that every
 * template carries its own required props at the type level.
 * Adding a new template is a two-step process:
 *   1. Add a new member to the `EmailTemplate` union.
 *   2. Create the corresponding React Email component in src/emails/.
 */

// ---------------------------------------------------------------------------
// Template Payloads
// ---------------------------------------------------------------------------

export interface WelcomeEmailProps {
  founderName?: string;
  startupName?: string;
  dashboardUrl: string;
  verificationUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface ProviderConnectedEmailProps {
  founderName?: string;
  startupName?: string;
  providerName?: string;
  providerDisplayName: string;
  connectionTimestamp?: string | Date;
  dashboardUrl: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface ProviderSyncFailedEmailProps {
  founderName?: string;
  startupName?: string;
  providerName?: string;
  providerDisplayName: string;
  failureReason?: string;
  dashboardUrl: string;
  reconnectUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface AccountDeletedEmailProps {
  founderName?: string;
  startupName?: string;
  feedbackUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

export interface VerificationCompletedEmailProps {
  founderName: string;
  startupName: string;
  verificationScore: number;
  profileUrl: string;
}

export interface VerificationFailedEmailProps {
  founderName: string;
  startupName: string;
  failureReason: string;
  retryUrl: string;
}

// ---------------------------------------------------------------------------
// Discriminated Union — extend here when adding templates
// ---------------------------------------------------------------------------

export type EmailTemplate =
  | { type: "welcome"; props: WelcomeEmailProps }
  | { type: "provider-connected"; props: ProviderConnectedEmailProps }
  | { type: "provider-sync-failed"; props: ProviderSyncFailedEmailProps }
  | { type: "account-deleted"; props: AccountDeletedEmailProps }
  | { type: "verification-completed"; props: VerificationCompletedEmailProps }
  | { type: "verification-failed"; props: VerificationFailedEmailProps };

/** Extract the string-literal template type. */
export type EmailTemplateName = EmailTemplate["type"];

// ---------------------------------------------------------------------------
// sendEmail Contract
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  /** Recipient email address. */
  to: string;

  /** The template to render + its props. */
  template: EmailTemplate;

  /**
   * Optional subject override.
   * When omitted, the template's default subject is used.
   */
  subject?: string;

  /** Optional reply-to address. */
  replyTo?: string;

  /**
   * Idempotency key forwarded to Resend to prevent duplicate sends
   * during retries.
   */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export type EmailErrorCode =
  | "MISSING_API_KEY"
  | "RENDER_FAILURE"
  | "SEND_FAILURE"
  | "UNKNOWN";

export interface EmailSuccessResult {
  success: true;
  /** The Resend message ID for tracing. */
  messageId: string;
}

export interface EmailErrorResult {
  success: false;
  code: EmailErrorCode;
  error: string;
}

export type SendEmailResult = EmailSuccessResult | EmailErrorResult;

// ---------------------------------------------------------------------------
// Email Provider Abstraction Contract
// ---------------------------------------------------------------------------

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<SendEmailResult>;
}
