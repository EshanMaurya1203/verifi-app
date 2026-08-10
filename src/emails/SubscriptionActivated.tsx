/**
 * Subscription Activated email — sent when a new subscription checkout is activated.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailCard } from "./components/EmailCard";
import type { SubscriptionActivatedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Welcome to Verifii Premium 🎉";

export default function SubscriptionActivatedEmail({
  founderName,
  startupName,
  planName,
  amountPaid,
  nextBillingDate,
  dashboardUrl,
}: SubscriptionActivatedEmailProps) {
  const greeting = founderName ? `Hi ${founderName},` : "Hello,";
  return (
    <EmailLayout preview={`Your Verifii ${planName} subscription is now active!`}>
      <EmailText variant="heading">Subscription Activated 🎉</EmailText>

      <EmailText variant="muted">
        {greeting} welcome to Verifii! Your subscription for <strong style={{ color: brandColors.textPrimary }}>{startupName || "your startup"}</strong> on the <strong>{planName}</strong> plan has been activated.
      </EmailText>

      <EmailCard variant="success">
        <div style={{ fontFamily: brandTypography.fonts.body, fontSize: brandTypography.sizes.sm }}>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: brandColors.textSecondary }}>Plan: </span>
            <strong style={{ color: brandColors.textPrimary }}>{planName}</strong>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: brandColors.textSecondary }}>Payment Status: </span>
            <strong style={{ color: brandColors.textPrimary }}>{amountPaid}</strong>
          </div>
          {nextBillingDate && (
            <div>
              <span style={{ color: brandColors.textSecondary }}>Next Renewal: </span>
              <strong style={{ color: brandColors.textPrimary }}>{nextBillingDate}</strong>
            </div>
          )}
        </div>
      </EmailCard>

      <EmailText variant="muted" margin="16px 0 24px">
        You now have access to advanced revenue verification, live metrics sync, and public trust badge features.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={dashboardUrl}>Access Dashboard</EmailButton>
      </Section>
    </EmailLayout>
  );
}
