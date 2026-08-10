/**
 * Payment Failed email — sent when a recurring billing payment attempt fails.
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";
import { EmailLayout } from "./components/EmailLayout";
import { EmailButton } from "./components/EmailButton";
import { EmailText } from "./components/EmailText";
import { EmailAlert } from "./components/EmailAlert";
import type { PaymentFailedEmailProps } from "@/notifications/email/types";

/** Default subject line used by `sendEmail` when no override is provided. */
export const defaultSubject = "Action Required: Payment failed for Verifii ⚠️";

export default function PaymentFailedEmail({
  founderName,
  startupName,
  planName,
  amountDue,
  failureReason,
  updatePaymentUrl,
}: PaymentFailedEmailProps) {
  const greeting = founderName ? `Hi ${founderName},` : "Hello,";
  return (
    <EmailLayout preview={`Action required: We were unable to process your payment of ${amountDue} for Verifii ${planName}.`}>
      <EmailText variant="heading">Payment Failed ⚠️</EmailText>

      <EmailText variant="muted">
        {greeting} we were unable to process your recent subscription payment of <strong>{amountDue}</strong> for <strong style={{ color: brandColors.textPrimary }}>{startupName || "your startup"}</strong> on the <strong>{planName}</strong> plan.
      </EmailText>

      <EmailAlert variant="danger" label="Payment Status">
        {failureReason || "Your payment attempt was declined by the issuing bank or payment gateway. Please update your payment method to prevent subscription suspension."}
      </EmailAlert>

      <EmailText variant="muted" margin="16px 0 24px">
        Please update your payment method to ensure uninterrupted access to your revenue verification tools and public trust badge.
      </EmailText>

      <Section style={{ textAlign: "center" as const, margin: "8px 0 16px" }}>
        <EmailButton href={updatePaymentUrl}>Update Payment Method</EmailButton>
      </Section>
    </EmailLayout>
  );
}
