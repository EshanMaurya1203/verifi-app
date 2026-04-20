import { getSupabaseServer } from "./supabase-server";

export interface ScoringResult {
  score: number;
  status: "verified" | "pending" | "unverified" | "flagged";
  tier: "verified" | "trusted" | "emerging" | "unverified" | "flagged";
}

function getTrustTier(score: number): ScoringResult["tier"] {
  if (score >= 80) return "verified";
  if (score >= 60) return "trusted";
  if (score >= 30) return "emerging";
  return "unverified";
}

/**
 * Trust Score Engine
 * Computes a deterministic trust score based on hard signals and verification metadata.
 */
export async function computeTrustScore(startup_id: number): Promise<ScoringResult> {
  const supabase = getSupabaseServer();
  let score = 0;
  const breakdown: Record<string, number> = {
    payment: 0,
    revenue: 0,
    video: 0,
    website: 0,
    identity: 0
  };

  // Fetch all necessary signals
  const { data: startup } = await supabase
    .from("startup_submissions")
    .select("*")
    .eq("id", startup_id)
    .single();

  if (!startup) return { score: 0, status: "unverified", tier: "unverified" };

  // 1. Payment Gateway Connection (+30 base)
  if (startup.payment_connected) {
    breakdown.payment = 30;
    score += 30;
  }

  // 2. Revenue Tiers (Incremental trust based on scale)
  const mrrValue = Number(startup.mrr) || 0;
  let revenueBonus = 0;
  
  if (mrrValue > 0) revenueBonus += 5;       // Tier 1: Generating Revenue
  if (mrrValue >= 1000) revenueBonus += 5;   // Tier 2: $1k+ MRR
  if (mrrValue >= 5000) revenueBonus += 5;   // Tier 3: $5k+ MRR
  if (mrrValue >= 10000) revenueBonus += 5;  // Tier 4: $10k+ MRR

  breakdown.revenue = revenueBonus;
  score += revenueBonus;

  // 3. Consistent Payments Check (+10)
  let hasConsistentPayments = false;
  if (startup.raw_metrics && startup.raw_metrics.payment_count >= 3) {
    hasConsistentPayments = true;
  } else {
    const { count: snapshotCount } = await supabase
      .from("revenue_transactions")
      .select("*", { count: 'exact', head: true })
      .eq("startup_id", startup_id)
      .in("provider", ["stripe", "razorpay"]);
    if (snapshotCount && snapshotCount > 0) hasConsistentPayments = true;
  }

  if (hasConsistentPayments) {
    const historicalBonus = 10;
    breakdown.revenue += historicalBonus;
    score += historicalBonus;
  }

  // 4. Video Verification (+20)
  if (startup.video_url && startup.video_url.trim().length > 5) {
    breakdown.video = 20;
    score += 20;
  }

  // 5. Website (+10)
  if (startup.website && startup.website.trim().length > 5 && !startup.website.includes("@")) {
    breakdown.website = 10;
    score += 10;
  }

  // 6. Identity Verified (+20)
  const isVerified = ["identity_verified", "approved", "verified"].includes(startup.verification_status);
  if (isVerified) {
    breakdown.identity = 20;
    score += 20;
  }

  // --- FRAUD PENALTIES ---
  const { data: fraudSignals } = await supabase
    .from("fraud_signals")
    .select("severity")
    .eq("startup_id", startup_id)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  let maxSeverity = 0;
  if (fraudSignals && fraudSignals.length > 0) {
    for (const signal of fraudSignals) {
      if (signal.severity > maxSeverity) maxSeverity = signal.severity;
      
      if (signal.severity === 5) score -= 40;
      else if (signal.severity === 4) score -= 25;
      else if (signal.severity === 3) score -= 15;
      else if (signal.severity === 2) score -= 5;
    }
  }

  // Final Clamp
  score = Math.max(0, Math.min(100, score));
  
  // Compute Tier
  let tier = getTrustTier(score);
  if (maxSeverity >= 4) tier = "flagged";

  // Derive status
  let status: ScoringResult["status"] = "unverified";
  if (maxSeverity >= 4) status = "flagged";
  else if (score >= 70) status = "verified";
  else if (score >= 31) status = "pending";

  // Persist back to DB
  await supabase
    .from("startup_submissions")
    .update({ 
      trust_score: score,
      trust_tier: tier,
      verification_status: status,
      trust_breakdown: breakdown
    })
    .eq("id", startup_id);

  return { score, status, tier };
}
