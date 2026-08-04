import type { Recommendation } from "./recommendations";

export interface ProviderMetrics {
  provider: string;
  starts: number;
  completions: number;
  conversionRate: number;
}

export function analyzeProviders(
  providerMetrics: ProviderMetrics[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (!providerMetrics || providerMetrics.length < 2) {
    return recommendations;
  }

  // Find Stripe and Razorpay metrics or max/min metrics
  const stripe = providerMetrics.find((p) => p.provider.toLowerCase() === "stripe");
  const razorpay = providerMetrics.find((p) => p.provider.toLowerCase() === "razorpay");

  if (stripe && razorpay) {
    const diff = stripe.conversionRate - razorpay.conversionRate;
    if (diff > 20) {
      recommendations.push({
        id: "provider_performance_imbalance_razorpay",
        target: {
          entityType: "provider",
          entityId: "razorpay",
        },
        category: "provider",
        severity: "high",
        kind: "warning",
        title: "Razorpay Provider Performance Imbalance",
        description: "Razorpay onboarding performs significantly worse than Stripe.",
        impact: "Founders selecting Razorpay experience significantly higher failure and drop-off rates.",
        evidence: [
          `Stripe conversion rate: ${stripe.conversionRate}%`,
          `Razorpay conversion rate: ${razorpay.conversionRate}%`,
          `Performance gap: ${Math.round(diff * 10) / 10}%`,
        ],
        action: "Audit Razorpay SDK integration, webhooks, and regional auth requirements.",
      });
    }
  } else {
    // General max vs min check across any 2+ providers
    const sorted = [...providerMetrics].sort((a, b) => b.conversionRate - a.conversionRate);
    const maxP = sorted[0];
    const minP = sorted[sorted.length - 1];
    const delta = maxP.conversionRate - minP.conversionRate;

    if (delta > 20) {
      recommendations.push({
        id: `provider_performance_imbalance_${minP.provider.toLowerCase()}`,
        target: {
          entityType: "provider",
          entityId: minP.provider.toLowerCase(),
        },
        category: "provider",
        severity: "high",
        kind: "warning",
        title: `Provider Performance Imbalance (${minP.provider})`,
        description: `${minP.provider} onboarding performs significantly worse than ${maxP.provider}.`,
        impact: `Founders selecting ${minP.provider} experience higher failure rates.`,
        evidence: [
          `${maxP.provider} conversion rate: ${maxP.conversionRate}%`,
          `${minP.provider} conversion rate: ${minP.conversionRate}%`,
          `Performance gap: ${Math.round(delta * 10) / 10}%`,
        ],
        action: `Audit ${minP.provider} API latency and onboarding integration flow.`,
      });
    }
  }

  return recommendations;
}
