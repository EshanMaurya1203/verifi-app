/**
 * Subscription Renewed email — sent when a recurring billing payment succeeds.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailCard } from "./components/EmailCard";
import type { SubscriptionRenewedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Your Verifii subscription has been renewed 💳";

export default function SubscriptionRenewedEmail({
  founderName,
  startupName,
  planName,
  amountPaid,
  nextBillingDate,
  dashboardUrl,
}: SubscriptionRenewedEmailProps) {
  const greeting = founderName ? `Hi ${founderName},` : "Hello,";
  return (
    <EmailLayout preview={`Your Verifii ${planName} subscription renewal of ${amountPaid} was successful.`}>
      <EmailText variant="heading">Subscription Renewed 💳</EmailText>

      <EmailText variant="muted">
        {greeting} your payment for <strong style={{ color: brandColors.textPrimary }}>{startupName || "your startup"}</strong> on the <strong>{planName}</strong> plan has been processed successfully.
      </EmailText>

      <EmailCard variant="success">
        <div style={{ fontFamily: brandTypography.fonts.body, fontSize: brandTypography.sizes.sm }}>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: brandColors.textSecondary }}>Plan: </span>
            <strong style={{ color: brandColors.textPrimary }}>{planName}</strong>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: brandColors.textSecondary }}>Amount Paid: </span>
            <strong style={{ color: brandColors.textPrimary }}>{amountPaid}</strong>
          </div>
          {nextBillingDate && (
            <div>
              <span style={{ color: brandColors.textSecondary }}>Next Billing Date: </span>
              <strong style={{ color: brandColors.textPrimary }}>{nextBillingDate}</strong>
            </div>
          )}
        </div>
      </EmailCard>

      <EmailText variant="muted" margin="16px 0 24px">
        Thank you for continuing with Verifii. Your verification badge and metrics remain live and up to date.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={dashboardUrl}>Go to Dashboard</EmailButton>
      </Section>
    </EmailLayout>
  );
}
