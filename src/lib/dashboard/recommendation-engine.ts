import type { StartupStatus } from "./startup-status";

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  severity: "critical" | "warning" | "info";
  impact: "high" | "medium" | "low";
  estimatedMinutes: number;
  title: string;
  description: string;
  cta: string;
  href: string;
}

type RecommendationConfig = Omit<Recommendation, "href"> & { hrefGenerator: (slug: string) => string };

const RECOMMENDATION_MAP: Record<string, RecommendationConfig> = {
  complete_profile: {
    id: "complete_profile",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 5,
    title: "Complete your profile",
    description: "A complete profile builds investor trust and is required to unlock the verification process, immediately boosting your Health Score.",
    cta: "Edit Profile",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  },
  declare_revenue: {
    id: "declare_revenue",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 2,
    title: "Declare your revenue",
    description: "Self-declared revenue establishes your baseline. It's the first step toward verified status and unlocks higher Health Score tiers.",
    cta: "Update Revenue",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  },
  connect_payment: {
    id: "connect_payment",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 5,
    title: "Connect payment provider",
    description: "Automatic revenue verification significantly increases your Health Score and provides the strongest trust signal to investors.",
    cta: "Connect Provider",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  complete_verification: {
    id: "complete_verification",
    priority: "high",
    severity: "warning",
    impact: "high",
    estimatedMinutes: 3,
    title: "Complete verification",
    description: "Unlocks your public profile and maximizes your Health Score, proving your startup's credibility to the community.",
    cta: "Resume Verification",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  upload_stronger_verification: {
    id: "upload_stronger_verification",
    priority: "medium",
    severity: "warning",
    impact: "medium",
    estimatedMinutes: 10,
    title: "Upload stronger verification",
    description: "Stronger trust signals elevate your startup's grade. Investors prioritize startups with robust, verifiable evidence.",
    cta: "Add Proof",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  publish_startup: {
    id: "publish_startup",
    priority: "medium",
    severity: "info",
    impact: "high",
    estimatedMinutes: 1,
    title: "Publish startup",
    description: "A public profile is the ultimate trust signal. It makes your verified startup visible to investors and maximizes your score.",
    cta: "Publish Now",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  }
};

/**
 * Generates a unified, sorted list of recommendations based on the StartupStatus.
 */
export function getRecommendations(status: StartupStatus, startupSlug: string): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const add = (id: string) => {
    const config = RECOMMENDATION_MAP[id];
    if (config) {
      recommendations.push({
        ...config,
        href: config.hrefGenerator(startupSlug)
      });
    }
  };

  // Evaluate in logical order (highest priority first)
  if (status.profile === "incomplete") {
    add("complete_profile");
  }

  if (status.revenue === "undeclared") {
    add("declare_revenue");
  }
  
  if (status.payment === "disconnected") {
    add("connect_payment");
  }

  if (status.proof === "none") {
    add("upload_stronger_verification");
  }

  if (status.verification !== "verified") {
    add("complete_verification");
  }

  if (status.publication === "private" && status.verification === "verified") {
    add("publish_startup");
  }

  return recommendations;
}
