/**
 * Verification Failed email — sent when a startup's revenue
 * verification does not pass.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailAlert } from "./components/EmailAlert";
import type { VerificationFailedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Verification update for your startup";

export default function VerificationFailedEmail({
  founderName,
  startupName,
  failureReason,
  retryUrl,
}: VerificationFailedEmailProps) {
  return (
    <EmailLayout
      preview={`Action needed: ${startupName} verification could not be completed.`}
    >
      <EmailText variant="heading">Verification Update</EmailText>

      <EmailText variant="muted">
        Hi {founderName}, we were unable to complete the revenue verification
        for{" "}
        <strong style={{ color: brandColors.textPrimary }}>{startupName}</strong>
        .
      </EmailText>

      {/* Failure reason callout */}
      <EmailAlert variant="danger" label="Reason">
        {failureReason}
      </EmailAlert>

      <EmailText variant="muted" margin="0 0 24px">
        {"Don't"} worry — this is often fixable. Please review the issue above
        and retry your verification. If you believe this is an error, contact
        our support team.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={retryUrl}>Retry Verification</EmailButton>
      </Section>
    </EmailLayout>
  );
}
