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

  // Fetch all necessary signals
  const { data: startup } = await supabase
    .from("startup_submissions")
    .select("*")
    .eq("id", startup_id)
    .single();

  if (!startup) return { score: 0, status: "unverified", tier: "unverified" };

  // 1. payment_connected → +50
  if (startup.payment_connected) {
    score += 50;
  }

  // 2. revenue_snapshots exists → +20
  const { count: snapshotCount } = await supabase
    .from("revenue_snapshots")
    .select("*", { count: 'exact', head: true })
    .eq("startup_id", startup_id)
    .eq("source", "api");

  if (snapshotCount && snapshotCount > 0) {
    score += 20;
  }

  // 3. last_verified_at < 24h → +10
  if (startup.last_verified_at) {
    const lastSync = new Date(startup.last_verified_at);
    const diffHours = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) {
      score += 10;
    }
  }

  // 4. has website → +10
  if (startup.website && startup.website.trim().length > 5) {
    score += 10;
  }

  // 5. founder verified → +10
  if (startup.verification_status === "identity_verified" || startup.verification_status === "approved" || startup.verification_status === "verified") {
    score += 10;
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
      verification_status: status
    })
    .eq("id", startup_id);

  return { score, status, tier };
}
