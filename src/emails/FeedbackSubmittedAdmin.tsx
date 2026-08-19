/**
 * Feedback Submitted Admin Notification Email Template
 *
 * Sent to the Verifii administrator when a user submits feedback.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailText } from "./components/EmailText";
import { EmailButton } from "./components/EmailButton";
import type { FeedbackSubmittedAdminEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "New User Feedback Received — Verifii";

const categoryLabels: Record<string, string> = {
  bug: "🐞 Bug / Problem",
  feature: "💡 Feature Suggestion",
  ui_ux: "🎨 UI / UX Feedback",
  general: "💬 General Feedback",
};

export default function FeedbackSubmittedAdminEmail({
  userEmail,
  category,
  message,
  submittedAtFormatted,
  adminInboxUrl,
}: FeedbackSubmittedAdminEmailProps) {
  const categoryFormatted = categoryLabels[category] || category;

  return (
    <EmailLayout preview={`New feedback from ${userEmail} (${categoryFormatted})`}>
      {/* ── Header ── */}
      <EmailText variant="heading" margin="0 0 16px">
        New User Feedback
      </EmailText>

      {/* ── Overview ── */}
      <EmailText variant="muted" margin="0 0 20px">
        A user has submitted feedback on Verifii. Details are below:
      </EmailText>

      {/* ── Metadata Card ── */}
      <div
        style={{
          backgroundColor: brandColors.surface ?? "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${brandColors.border}`,
          borderRadius: "8px",
          padding: "16px 20px",
          margin: "0 0 20px",
        }}
      >
        <Text style={{ fontWeight: 600, color: brandColors.textPrimary, fontSize: brandTypography.sizes.sm, fontFamily: brandTypography.fonts.body, margin: "0 0 4px" }}>
          User: <span style={{ color: brandColors.primary }}>{userEmail}</span>
        </Text>
        <Text style={{ fontWeight: 600, color: brandColors.textPrimary, fontSize: brandTypography.sizes.sm, fontFamily: brandTypography.fonts.body, margin: "0 0 4px" }}>
          Category: <span style={{ color: brandColors.textPrimary }}>{categoryFormatted}</span>
        </Text>
        {submittedAtFormatted && (
          <Text style={{ color: brandColors.textMuted, fontSize: brandTypography.sizes.xs, fontFamily: brandTypography.fonts.body, margin: "0" }}>
            Submitted: {submittedAtFormatted}
          </Text>
        )}
      </div>

      {/* ── Message Content ── */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          borderLeft: `3px solid ${brandColors.primary}`,
          padding: "16px 20px",
          margin: "0 0 24px",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <Text style={{ color: brandColors.textPrimary, fontSize: brandTypography.sizes.sm, fontFamily: brandTypography.fonts.body, lineHeight: "1.6", margin: "0", whiteSpace: "pre-wrap" }}>
          {message}
        </Text>
      </div>

      {/* ── CTA Button ── */}
      <div style={{ margin: "24px 0" }}>
        <EmailButton href={adminInboxUrl}>
          View &amp; Reply in Admin Inbox
        </EmailButton>
      </div>
    </EmailLayout>
  );
}
