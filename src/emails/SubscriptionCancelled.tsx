/**
 * Subscription Cancelled email — sent when a user's subscription is cancelled.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailAlert } from "./components/EmailAlert";
import type { SubscriptionCancelledEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Your Verifii subscription has been cancelled";

export default function SubscriptionCancelledEmail({
  founderName,
  startupName,
  planName,
  effectiveEndDate,
  reactivateUrl,
}: SubscriptionCancelledEmailProps) {
  const greeting = founderName ? `Hi ${founderName},` : "Hello,";
  return (
    <EmailLayout preview={`Your Verifii ${planName} subscription has been cancelled.`}>
      <EmailText variant="heading">Subscription Cancelled ℹ️</EmailText>

      <EmailText variant="muted">
        {greeting} your subscription to the <strong>{planName}</strong> plan for <strong style={{ color: brandColors.textPrimary }}>{startupName || "your startup"}</strong> has been cancelled.
      </EmailText>

      <EmailAlert variant="info" label="Access Notice">
        {effectiveEndDate
          ? `You will maintain full access to your plan features until ${effectiveEndDate}. After this date, your plan will revert to the free Viewer tier.`
          : "Your account has reverted to the free Viewer tier."}
      </EmailAlert>

      <EmailText variant="muted" margin="16px 0 24px">
        We'd love to welcome you back anytime. You can reactivate your subscription whenever you are ready.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={reactivateUrl}>Reactivate Subscription</EmailButton>
      </Section>
    </EmailLayout>
  );
}
