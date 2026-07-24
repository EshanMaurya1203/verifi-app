/**
 * Provider Connected Email Template — NTF-001
 *
 * Sent when a founder successfully connects a payment provider (Stripe/Razorpay) for the first time.
 * Confirms secure connection, provides a security notice, and outlines verification benefits.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import type { ProviderConnectedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Payment Provider Connected 🔒";

export default function ProviderConnectedEmail({
  founderName,
  startupName,
  providerDisplayName = "Payment Provider",
  dashboardUrl,
  supportEmail = "support@verifii.in",
}: ProviderConnectedEmailProps) {
  const greeting = founderName ? `Hello, ${founderName}!` : "Hello!";

  return (
    <EmailLayout preview={`${providerDisplayName} has been successfully connected to Verifii.`}>
      {/* ── Header / Greeting ── */}
      <EmailText variant="heading" margin="0 0 16px">
        {greeting}
      </EmailText>

      {/* ── Confirmation Paragraph ── */}
      <EmailText variant="muted" margin="0 0 20px">
        <strong style={{ color: brandColors.textPrimary }}>{providerDisplayName}</strong> has been successfully connected to Verifii
        {startupName ? <> for <strong style={{ color: brandColors.textPrimary }}>{startupName}</strong></> : null}.
        Verifii can now securely verify your revenue metrics directly from your payment processor without storing sensitive transaction credentials.
      </EmailText>

      {/* ── Security Notice ── */}
      <div
        style={{
          backgroundColor: brandColors.surface ?? "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${brandColors.border}`,
          borderRadius: "8px",
          padding: "16px 20px",
          margin: "0 0 24px",
        }}
      >
        <Text style={{ fontWeight: 600, color: brandColors.textPrimary, fontSize: brandTypography.sizes.base, fontFamily: brandTypography.fonts.body, margin: "0 0 6px" }}>
          🔒 Security Notice
        </Text>
        <EmailText variant="caption" margin="0">
          If you did not authorize connecting {providerDisplayName} to your Verifii account, please contact our security team immediately at{" "}
          <a href={`mailto:${supportEmail}`} style={{ color: brandColors.primary, textDecoration: "underline" }}>
            {supportEmail}
          </a>
          .
        </EmailText>
      </div>

      {/* ── What's Next ── */}
      <EmailText variant="subheading" margin="0 0 12px">
        What{"'"}s Next
      </EmailText>
      <ul
        style={{
          margin: "0 0 24px",
          paddingLeft: "20px",
          color: brandColors.textSecondary,
          fontFamily: brandTypography.fonts.body,
          fontSize: brandTypography.sizes.sm,
          lineHeight: brandTypography.lineHeights.relaxed,
        }}
      >
        <li style={{ marginBottom: "8px" }}>
          <strong style={{ color: brandColors.textPrimary }}>Revenue Verification:</strong> Automated computation of verified MRR.
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong style={{ color: brandColors.textPrimary }}>Trust Profile:</strong> Display verified metrics badge on your public profile.
        </li>
        <li>
          <strong style={{ color: brandColors.textPrimary }}>Leaderboard Eligibility:</strong> Qualify for top verified startup rankings.
        </li>
      </ul>

      {/* ── Primary CTA ── */}
      <Section style={{ textAlign: "center" as const, margin: "24px 0 16px" }}>
        <EmailButton href={dashboardUrl}>Go to Dashboard</EmailButton>
      </Section>
    </EmailLayout>
  );
}
