export type FraudSignals = {
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
  signals: string[];
};

export function detectFraud(signals: FraudSignals): FraudAssessment {
  let score = 0;
  const issues: string[] = [];

  // 1. High Revenue Anomaly
  if (signals.mrr > 50000 && !signals.has_api) {
    score += 40;
    issues.push("High MRR without API verification");
  }

  // 2. Proof Inconsistency
  if (signals.has_proof && !signals.has_api && signals.mrr > 10000) {
    score += 20;
    issues.push("Manual proof provided for significant revenue without API link");
  }

  // 3. Ratio Anomaly (ARR should be ~12x MRR)
  const expectedArr = signals.mrr * 12;
  const arrDiff = Math.abs(signals.arr - expectedArr);
  if (signals.mrr > 0 && arrDiff > expectedArr * 0.5) {
    score += 30;
    issues.push("Inconsistent MRR to ARR ratio");
  }

  // 4. Missing Infrastructure
  if (!signals.has_website) {
    score += 15;
    issues.push("Missing business website");
  }

  if (!signals.has_socials) {
    score += 10;
    issues.push("No founder social presence linked");
  }

  // 5. Unrealistic Growth (If we had historical data, we'd check here)

  let risk_level: "low" | "medium" | "high" = "low";
  if (score >= 50) {
    risk_level = "high";
  } else if (score >= 20) {
    risk_level = "medium";
  }

  return {
    score: Math.min(score, 100),
    risk_level,
    signals: issues,
  };
}
