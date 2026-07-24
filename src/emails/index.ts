/**
 * Barrel export for email templates.
 *
 * Exports TEMPLATE COMPONENTS ONLY.
 * Shared UI components remain inside `src/emails/components/`
 * and should be imported directly by consumers that need them.
 */

export { default as WelcomeEmail } from "./Welcome";
export { default as VerificationCompletedEmail } from "./VerificationCompleted";
export { default as VerificationFailedEmail } from "./VerificationFailed";
