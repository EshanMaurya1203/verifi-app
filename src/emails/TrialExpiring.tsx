/**
 * Trial Expiring email — sent 3 days before a subscription trial expires.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailAlert } from "./components/EmailAlert";
import type { TrialExpiringEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Reminder: Your Verifii trial is ending soon ⏳";

export default function TrialExpiringEmail({
  founderName,
  startupName,
  planName,
  trialEndFormatted,
  billingUrl,
}: TrialExpiringEmailProps) {
  const greeting = founderName ? `Hi ${founderName},` : "Hello,";
  return (
    <EmailLayout preview={`Your Verifii ${planName} trial ends on ${trialEndFormatted}.`}>
      <EmailText variant="heading">Trial Ending Soon ⏳</EmailText>

      <EmailText variant="muted">
        {greeting} your trial period for <strong style={{ color: brandColors.textPrimary }}>{startupName || "your startup"}</strong> on the <strong>{planName}</strong> plan will expire on <strong>{trialEndFormatted}</strong>.
      </EmailText>

      <EmailAlert variant="warning" label="Trial Expiration Notice">
        After <strong>{trialEndFormatted}</strong>, your trial period will end. To maintain uninterrupted access to live revenue verification, automated sync, and public trust badge features, ensure your billing payment method is up to date.
      </EmailAlert>

      <EmailText variant="muted" margin="16px 0 24px">
        You can manage your plan or payment details anytime in your billing settings.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={billingUrl}>Manage Subscription</EmailButton>
      </Section>
    </EmailLayout>
  );
}
