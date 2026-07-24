/**
 * Welcome Email Template — NTF-000B
 *
 * Sent when a founder completes onboarding.
 * Welcomes the founder, introduces Verifii's mission to build trust through verified revenue,
 * and guides them toward verifying their startup.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import type { WelcomeEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Welcome to Verifii 🎉";

export default function WelcomeEmail({
  founderName,
  startupName,
  dashboardUrl,
  verificationUrl,
  supportEmail = "support@verifii.in",
}: WelcomeEmailProps) {
  const targetUrl = verificationUrl || dashboardUrl;
  const greeting = founderName ? `Welcome, ${founderName}!` : "Welcome!";

  return (
    <EmailLayout preview={`Welcome to Verifii! Verify your startup revenue and build instant trust.`}>
      {/* ── Header / Greeting ── */}
      <EmailText variant="heading" margin="0 0 16px">
        {greeting}
      </EmailText>

      {/* ── Introduction ── */}
      <EmailText variant="muted" margin="0 0 20px">
        Thank you for joining Verifii. {startupName ? <><strong style={{ color: brandColors.textPrimary }}>{startupName}</strong> is now registered. </> : null}
        Verifii helps ambitious founders build transparent trust with investors, partners, and customers by independently verifying startup revenue metrics directly from your payment processors.
      </EmailText>

      {/* ── Primary CTA ── */}
      <Section style={{ textAlign: "center" as const, margin: "24px 0 28px" }}>
        <EmailButton href={targetUrl}>Verify Your Startup</EmailButton>
      </Section>

      {/* ── What's Next ── */}
      <div
        style={{
          backgroundColor: brandColors.surface ?? "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${brandColors.border}`,
          borderRadius: "8px",
          padding: "20px 20px 16px",
          margin: "0 0 24px",
        }}
      >
        <EmailText variant="subheading" margin="0 0 12px">
          What{"'"}s Next
        </EmailText>
        <ol
          style={{
            margin: "0",
            paddingLeft: "20px",
            color: brandColors.textSecondary,
            fontFamily: brandTypography.fonts.body,
            fontSize: brandTypography.sizes.sm,
            lineHeight: brandTypography.lineHeights.relaxed,
          }}
        >
          <li style={{ marginBottom: "8px" }}>
            <strong style={{ color: brandColors.textPrimary }}>Connect Stripe or Razorpay:</strong> Securely link your active payment processor.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong style={{ color: brandColors.textPrimary }}>Verify your revenue:</strong> Automatically compute your verified MRR and growth metrics.
          </li>
          <li>
            <strong style={{ color: brandColors.textPrimary }}>Build trust:</strong> Share your verified badge and public profile with confidence.
          </li>
        </ol>
      </div>

      {/* ── Support Section ── */}
      <EmailText variant="caption" margin="0 0 12px">
        Need help getting started? If you encounter any issues or have questions, reach out to our team at{" "}
        <a href={`mailto:${supportEmail}`} style={{ color: brandColors.primary, textDecoration: "underline" }}>
          {supportEmail}
        </a>
        .
      </EmailText>

      {/* ── Security Note ── */}
      <Text
        style={{
          color: brandColors.textMuted,
          fontSize: brandTypography.sizes.xs,
          fontFamily: brandTypography.fonts.body,
          lineHeight: brandTypography.lineHeights.normal,
          margin: "12px 0 0",
        }}
      >
        If you didn{"'"}t create a Verifii account, please disregard this email or contact support.
      </Text>
    </EmailLayout>
  );
}
