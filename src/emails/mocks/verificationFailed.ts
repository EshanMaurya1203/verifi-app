import type { VerificationFailedEmailProps } from "@/notifications/email/types";

export const mockVerificationFailedProps: VerificationFailedEmailProps = {
  founderName: "Aditi",
  startupName: "NexusAI",
  failureReason: "We could not verify the Stripe connection because the API key provided was revoked or expired.",
  retryUrl: "https://www.verifii.in/dashboard/settings",
};
