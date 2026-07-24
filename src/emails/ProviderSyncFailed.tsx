/**
 * Provider Sync Failed Email Template — NTF-002
 *
 * Sent when revenue synchronization fails due to non-recoverable credential errors
 * (e.g., revoked API key, expired authorization, invalid live key).
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import type { ProviderSyncFailedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Action Required: Payment Provider Sync Needs Attention ⚠️";

export default function ProviderSyncFailedEmail({
  founderName,
  startupName,
  providerDisplayName = "Payment Provider",
  failureReason,
  dashboardUrl,
  reconnectUrl,
  supportEmail = "support@verifii.in",
}: ProviderSyncFailedEmailProps) {
  const greeting = founderName ? `Hello, ${founderName}!` : "Hello!";
  const targetUrl = reconnectUrl || dashboardUrl;

  const defaultReason = `Verifii was unable to synchronize revenue metrics with ${providerDisplayName}. This usually happens when API credentials are updated or authorization expires.`;
  const displayReason = failureReason || defaultReason;

  return (
    <EmailLayout preview={`Action required: Unable to sync revenue with ${providerDisplayName}.`}>
      {/* ── Header / Greeting ── */}
      <EmailText variant="heading" margin="0 0 16px">
        {greeting}
      </EmailText>

      {/* ── Explanation ── */}
      <EmailText variant="muted" margin="0 0 20px">
        We encountered an issue while synchronizing revenue metrics for{" "}
        {startupName ? <strong style={{ color: brandColors.textPrimary }}>{startupName}</strong> : "your startup"}{" "}
        from <strong style={{ color: brandColors.textPrimary }}>{providerDisplayName}</strong>.
      </EmailText>

      {/* ── Failure Details Box ── */}
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
          ⚠️ Details
        </Text>
        <EmailText variant="caption" margin="0">
          {displayReason}
        </EmailText>
      </div>

      {/* ── Recommended Action ── */}
      <EmailText variant="subheading" margin="0 0 12px">
        Recommended Action
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
          <strong style={{ color: brandColors.textPrimary }}>Reconnect Provider:</strong> Click below to verify or update your {providerDisplayName} API credentials.
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong style={{ color: brandColors.textPrimary }}>Check Live Mode:</strong> Ensure you are using active Live Mode keys on Razorpay or Stripe.
        </li>
        <li>
          <strong style={{ color: brandColors.textPrimary }}>Resume Sync:</strong> Once updated, revenue verification will resume automatically.
        </li>
      </ul>

      {/* ── Primary CTA ── */}
      <Section style={{ textAlign: "center" as const, margin: "24px 0 20px" }}>
        <EmailButton href={targetUrl}>Reconnect Provider</EmailButton>
      </Section>

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
        If you intentionally disconnected {providerDisplayName} from Verifii, no action is required. If you need help, reach out to{" "}
        <a href={`mailto:${supportEmail}`} style={{ color: brandColors.primary, textDecoration: "underline" }}>
          {supportEmail}
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
