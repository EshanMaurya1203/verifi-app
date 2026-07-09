import type { Recommendation } from "./recommendation-engine";
import type { StartupStatus } from "./startup-status";

export interface FounderAction {
  title: string;
  description: string;
  cta: string;
  href: string;
  statusMessage: string;
}

export function getNextFounderAction(
  primaryRecommendation: Recommendation | null, 
  status: StartupStatus,
  startupSlug: string
): FounderAction {
  // Determine status message based on canonical status
  let statusMessage = "Let's set up your startup profile.";
  
  if (status.publication === "public") {
    statusMessage = "Your startup is live and fully verified.";
  } else if (status.verification === "verified") {
    statusMessage = "Publish your startup to get discovered by the community.";
  } else if (status.verification === "pending") {
    statusMessage = "Your verification is running. We'll notify you when it's complete.";
  } else if (status.payment === "disconnected" && status.revenue === "declared") {
    statusMessage = "Connect your payment provider to complete verification.";
  } else if (status.profile === "complete") {
    statusMessage = "Complete the remaining steps to build trust and publish your profile.";
  }

  if (!primaryRecommendation) {
    return {
      title: "Share Your Profile",
      description: "Show off your verified status by sharing your profile with investors and customers.",
      cta: "View Public Profile",
      href: `/startup/${encodeURIComponent(startupSlug)}`,
      statusMessage
    };
  }

  return {
    title: primaryRecommendation.title,
    description: primaryRecommendation.description,
    cta: primaryRecommendation.cta,
    href: primaryRecommendation.href,
    statusMessage
  };
}
