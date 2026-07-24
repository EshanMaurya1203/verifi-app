/**
 * Verification Completed email — sent when a startup's revenue
 * verification passes successfully.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailMetric } from "./components/EmailMetric";
import type { VerificationCompletedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Your verification is complete ✅";

export default function VerificationCompletedEmail({
  founderName,
  startupName,
  verificationScore,
  profileUrl,
}: VerificationCompletedEmailProps) {
  return (
    <EmailLayout
      preview={`${startupName} has been verified with a score of ${verificationScore}/100.`}
    >
      <EmailText variant="heading">Verification Complete 🎯</EmailText>

      <EmailText variant="muted">
        Great news, {founderName}!{" "}
        <strong style={{ color: brandColors.textPrimary }}>{startupName}</strong>{" "}
        has passed Verifii revenue verification.
      </EmailText>

      {/* Score highlight */}
      <EmailMetric
        label="Verification Score"
        value={verificationScore}
        suffix="/100"
      />

      <EmailText variant="muted" margin="0 0 24px">
        Your public profile is now live. Share your verified badge with
        investors, partners, and accelerators to build trust instantly.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={profileUrl}>View Public Profile</EmailButton>
      </Section>
    </EmailLayout>
  );
}
