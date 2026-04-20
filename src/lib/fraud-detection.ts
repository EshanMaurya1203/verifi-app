/**
 * Fraud Detection Module (v2)
 * Analyzes patterns in payment events or submission profiles
 * to identify high-risk entries.
 */

/** Profile-based fraud check (used at submission time) */
type FraudProfile = {
  mrr: number;
  arr: number;
  has_proof: boolean;
  has_api: boolean;
  has_website: boolean;
  has_socials: boolean;
};

export type FraudAssessment = {
  score: number;
  risk_level: "low" | "medium" | "high";
  flags: string[];
};

export function detectFraud(input: any[] | FraudProfile): string[] | FraudAssessment {
  // ── Profile-based fraud detection (submission flow) ──
  if (!Array.isArray(input)) {
    const profile = input as FraudProfile;
    let score = 0;
    const flags: string[] = [];

    if (profile.mrr > 0 && profile.arr > 0 && profile.arr < profile.mrr * 10) {
      score += 10; // plausible MRR/ARR ratio
    } else {
      flags.push("mrr_arr_mismatch");
      score -= 15;
    }

    if (profile.has_api) score += 30;
    if (profile.has_proof) score += 15;
    if (profile.has_website) score += 10;
    if (profile.has_socials) score += 10;

    if (profile.mrr > 500000 && !profile.has_api && !profile.has_proof) {
      flags.push("unverified_high_revenue");
      score -= 25;
    }

    const risk_level: "low" | "medium" | "high" =
      score >= 30 ? "low" : score >= 0 ? "medium" : "high";

    return { score: Math.max(0, Math.min(100, score)), risk_level, flags };
  }

  // ── Event-based fraud detection (payment sync flow) ──
  const events = input;
  const flags: string[] = [];

  if (!events || events.length < 2) {
    flags.push("low_data");
    return flags;
  }

  const amounts = events.map(e => Number(e.amount));

  const max = Math.max(...amounts);
  const min = Math.min(...amounts);

  // Spiky revenue: Max is 10x greater than min
  if (min > 0 && max > min * 10) {
    flags.push("spiky_revenue");
  }

  // High failure rate: more than 5 failed payments
  const failureCount = events.filter(e => e.status === "failed" || e.status === "rejected").length;
  if (failureCount > 5) {
    flags.push("high_failure_rate");
  }

  return flags;
}

