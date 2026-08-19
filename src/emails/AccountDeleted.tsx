/**
 * Account Deleted Email Template — NTF-003
 *
 * Sent when a founder permanently deletes their Verifii account.
 * Confirms complete data purge and provides a security notice.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailText } from "./components/EmailText";
import type { AccountDeletedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Your Verifii Account Has Been Deleted";

export default function AccountDeletedEmail({
  founderName,
  startupName,
  supportEmail = "support@verifii.in",
  feedbackUrl,
}: AccountDeletedEmailProps) {
  const greeting = founderName ? `Goodbye, ${founderName}` : "Goodbye";

  return (
    <EmailLayout preview="Your Verifii account and all associated data have been permanently deleted.">
      {/* ── Header / Greeting ── */}
      <EmailText variant="heading" margin="0 0 16px">
        {greeting}
      </EmailText>

      {/* ── Confirmation Paragraph ── */}
      <EmailText variant="muted" margin="0 0 20px">
        As requested, your Verifii account{startupName ? <> and all associated data for <strong style={{ color: brandColors.textPrimary }}>{startupName}</strong></> : null}{" "}
        have been permanently deleted from our platform.
      </EmailText>

      {/* ── Summary Card ── */}
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
          🗑️ Permanent Purge Complete
        </Text>
        <EmailText variant="caption" margin="0">
          All associated startup submissions, encrypted payment processor connections, and verified revenue metrics have been permanently removed.
        </EmailText>
      </div>

      {/* ── Optional Feedback CTA ── */}
      {feedbackUrl && (
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: `1px solid ${brandColors.border}`,
            borderRadius: "8px",
            padding: "16px 20px",
            margin: "0 0 24px",
          }}
        >
          <Text style={{ fontWeight: 600, color: brandColors.textPrimary, fontSize: brandTypography.sizes.sm, fontFamily: brandTypography.fonts.body, margin: "0 0 6px" }}>
            Help us improve
          </Text>
          <EmailText variant="caption" margin="0 0 12px">
            We&apos;re constantly refining Verifii. If you have 30 seconds, we would love to know how we could have served you better.
          </EmailText>
          <a
            href={feedbackUrl}
            style={{
              display: "inline-block",
              backgroundColor: brandColors.primary,
              color: "#000000",
              fontWeight: 700,
              fontSize: brandTypography.sizes.xs,
              padding: "8px 16px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Share Exit Feedback
          </a>
        </div>
      )}

      {/* ── Security Notice ── */}
      <Text
        style={{
          color: brandColors.textMuted,
          fontSize: brandTypography.sizes.xs,
          fontFamily: brandTypography.fonts.body,
          lineHeight: brandTypography.lineHeights.normal,
          margin: "12px 0 0",
        }}
      >
        If you did not authorize this account deletion, please contact our security team immediately at{" "}
        <a href={`mailto:${supportEmail}`} style={{ color: brandColors.primary, textDecoration: "underline" }}>
          {supportEmail}
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
