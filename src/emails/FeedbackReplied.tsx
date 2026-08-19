/**
 * Feedback Replied User Notification Email Template
 *
 * Sent to a user when the Verifii team replies to their feedback submission.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailText } from "./components/EmailText";
import { EmailButton } from "./components/EmailButton";
import type { FeedbackRepliedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "The Verifii Team replied to your feedback";

const categoryLabels: Record<string, string> = {
  bug: "Bug / Problem",
  feature: "Feature Suggestion",
  ui_ux: "UI / UX Feedback",
  general: "General Feedback",
};

export default function FeedbackRepliedEmail({
  category,
  messageSnippet,
  replyBody,
  feedbackUrl,
}: FeedbackRepliedEmailProps) {
  const categoryFormatted = categoryLabels[category] || category;

  return (
    <EmailLayout preview="The Verifii team has replied to your feedback submission.">
      {/* ── Header ── */}
      <EmailText variant="heading" margin="0 0 16px">
        New Reply to Your Feedback
      </EmailText>

      {/* ── Overview ── */}
      <EmailText variant="muted" margin="0 0 20px">
        Thanks for helping make Verifii better. The Verifii team has reviewed your submission and left a reply:
      </EmailText>

      {/* ── Original Feedback Context ── */}
      <div
        style={{
          backgroundColor: brandColors.surface ?? "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${brandColors.border}`,
          borderRadius: "8px",
          padding: "12px 16px",
          margin: "0 0 16px",
        }}
      >
        <Text style={{ color: brandColors.textMuted, fontSize: brandTypography.sizes.xs, fontFamily: brandTypography.fonts.body, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Your {categoryFormatted}:
        </Text>
        <Text style={{ color: brandColors.textPrimary, fontSize: brandTypography.sizes.xs, fontFamily: brandTypography.fonts.body, fontStyle: "italic", margin: "0" }}>
          &ldquo;{messageSnippet}&rdquo;
        </Text>
      </div>

      {/* ── Verifii Team Reply ── */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderLeft: `3px solid ${brandColors.primary}`,
          padding: "16px 20px",
          margin: "0 0 24px",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <Text style={{ fontWeight: 600, color: brandColors.primary, fontSize: brandTypography.sizes.xs, fontFamily: brandTypography.fonts.body, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Verifii Team Response:
        </Text>
        <Text style={{ color: brandColors.textPrimary, fontSize: brandTypography.sizes.sm, fontFamily: brandTypography.fonts.body, lineHeight: "1.6", margin: "0", whiteSpace: "pre-wrap" }}>
          {replyBody}
        </Text>
      </div>

      {/* ── CTA Button ── */}
      <div style={{ margin: "24px 0" }}>
        <EmailButton href={feedbackUrl}>
          View Feedback Thread
        </EmailButton>
      </div>

      {/* ── Closing ── */}
      <EmailText variant="muted" margin="16px 0 0">
        You can check the status and reply history anytime from your Verifii Feedback page.
      </EmailText>
    </EmailLayout>
  );
}
