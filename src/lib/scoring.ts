import { getSupabaseServer } from "./supabase-server";
import { detectFraud } from "./fraud";

export interface FraudSignals {
  rate_limit_violations: number;
  spike_events: number;
  penalty_count: number;
}

/**
 * Advanced Trust Score Calculation based on Revenue Events and Fraud Signals
 * 
 * Logic:
 * 1. Base Score = Avg Revenue / 100
 * 2. Consistency: High variance reduces score (-10 to -20)
 * 3. Growth: Upward trend increases score (+5 to +15)
 * 4. Fraud Penalties:
 *    - Each spike: -10
 *    - Each rate limit violation: -15
 *    - Repeated offenses: Exponential scaling via penalty_count
 */
export function calculateTrustScore(
  events: { amount: number; timestamp: number }[],
  fraudSignals: FraudSignals = { rate_limit_violations: 0, spike_events: 0, penalty_count: 0 }
): number {
  if (!events || events.length === 0) return 0;

  // 1. Sort by timestamp (ascending)
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // 2. Average Revenue
  const total = sorted.reduce((sum, e) => sum + Number(e.amount), 0);
  const average = total / sorted.length;

  // 3. Consistency Adjustment (-10 to -20)
  const variance = sorted.reduce((sum, e) => sum + Math.pow(Number(e.amount) - average, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const cv = average > 0 ? stdDev / average : 0; // Coefficient of Variation
  
  let consistencyAdjustment = 0;
  if (cv > 0.3) {
    consistencyAdjustment = -Math.min(20, 10 + (cv - 0.3) * 14);
  }

  // 4. Growth Adjustment (+5 to +15)
  let growthAdjustment = 0;
  if (sorted.length >= 2) {
    const first = Number(sorted[0].amount);
    const last = Number(sorted[sorted.length - 1].amount);
    const growth = (last - first) / (first || 1);
    
    if (growth > 0) {
      growthAdjustment = Math.min(15, 5 + (growth - 0.05) * 22);
    }
  }

    // 5. Pattern Detection (Anti-bot / Entropy check)
    let patternPenalty = 0;
    if (sorted.length >= 6) {
      const amounts = sorted.map((e) => Number(e.amount));
      const uniqueValues = new Set(amounts).size;
      const entropyRatio = uniqueValues / amounts.length;

      // Detect repetition signals
      let isRepetitive = entropyRatio < 0.5;
      let sequenceDetected = false;
      for (let len = 2; len <= Math.floor(amounts.length / 2); len++) {
        const firstSeq = amounts.slice(-len * 2, -len);
        const secondSeq = amounts.slice(-len);
        if (firstSeq.length === len && firstSeq.every((v, i) => v === secondSeq[i])) {
          sequenceDetected = true;
          isRepetitive = true;
          break;
        }
      }

      if (isRepetitive) {
        // Analyze timestamp distribution (Coefficient of Variation for gaps)
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
        }
        
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
        const gapStdDev = Math.sqrt(gapVariance);
        const gapCV = avgGap > 0 ? gapStdDev / avgGap : 0;

        if (gapCV < 0.4) {
          // Repetition + Fixed Timing (Robotic behavior)
          patternPenalty = 20;
        } else {
          // Repetition + Varied Timing (Potentially legitimate but suspicious)
          patternPenalty = 5;
        }
      } else if (entropyRatio < 0.7) {
        // Mild entropy penalty
        patternPenalty = 5;
      }
    }

  // 6. Fraud Penalties
  const spikePenalty = fraudSignals.spike_events * 10;
  const rateLimitPenalty = fraudSignals.rate_limit_violations * 15;
  const repeatPenalty = Math.pow(fraudSignals.penalty_count, 1.5) * 5;
  const totalFraudPenalty = spikePenalty + rateLimitPenalty + repeatPenalty;

  // 7. Base Score & Final Calculation
  const baseScore = average / 100;
  const score = baseScore + consistencyAdjustment + growthAdjustment - patternPenalty - totalFraudPenalty;

  // 8. Clamp & Return Integer
  return Math.round(Math.max(0, Math.min(100, score)));
}

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
export async function computeTrustScore(
  startup_id: number,
  options: { startup?: any; persist?: boolean } = { persist: true }
): Promise<ScoringResult & { updateData?: Record<string, unknown> }> {
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
  let startup = options.startup;
  if (!startup) {
    const { data } = await supabase
      .from("startup_submissions")
      .select("*")
      .eq("id", startup_id)
      .single();
    startup = data;
  }

  if (!startup) return { score: 0, status: "unverified", tier: "unverified" };

  // 1. Payment Gateway Connection (+30 base)
  if (startup.payment_connected) {
    breakdown.payment = 30;
    score += 30;
  }

  // 2. Revenue Stability Check (Stability-based scoring)
  const { data: historicalSnapshots } = await supabase
    .from("revenue_snapshots")
    .select("total_revenue")
    .eq("startup_id", startup_id)
    .gt("total_revenue", 0)
    .order("created_at", { ascending: false })
    .limit(4); // Use the last 4 valid snapshots

  const latestMrr = Number(startup.mrr) || 0;
  let avgHistoricalRevenue = latestMrr;

  if (historicalSnapshots && historicalSnapshots.length > 0) {
    const sum = historicalSnapshots.reduce((acc, s) => acc + Number(s.total_revenue), 0);
    avgHistoricalRevenue = sum / historicalSnapshots.length;
  }

  // Use historical average for tier scoring to prevent instant spikes
  const scoringMrr = avgHistoricalRevenue;
  let revenueBonus = 0;
  
  if (scoringMrr > 0) revenueBonus += 5;       // Tier 1: Generating Revenue
  if (scoringMrr >= 1000) revenueBonus += 5;   // Tier 2: $1k+ MRR
  if (scoringMrr >= 5000) revenueBonus += 5;   // Tier 3: $5k+ MRR
  if (scoringMrr >= 10000) revenueBonus += 5;  // Tier 4: $10k+ MRR

  breakdown.revenue = revenueBonus;
  score += revenueBonus;

  // 3. Consistent Payments Check (+10)
  let hasConsistentPayments = false;
  if (startup.raw_metrics && (startup.raw_metrics as any).payment_count >= 3) {
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

  // 7. Fraud Detection
  const { data: history } = await supabase
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startup_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const historyAmounts = (history ?? []).map(h => Number(h.amount));
  const historyTimestamps = (history ?? []).map(h => new Date(h.created_at).getTime());

  const currentTxAmount = historyAmounts[0] || 0;
  const prevTxAmounts = historyAmounts.slice(1);
  const prevTxTimestamps = historyTimestamps.slice(1);

  const fraud = detectFraud({
    amount: currentTxAmount,
    previousTransactions: prevTxAmounts,
    timestamps: prevTxTimestamps,
    now: Date.now()
  });

  const isSpikeDetected = fraud.reason === "spike";
  const isRateLimited = fraud.reason === "rate_limit";
  
  // Penalty Persistence, Decay & Clean Events Logic
  const lastPenaltyAt = startup.last_penalty_at ? new Date(startup.last_penalty_at) : null;
  let penaltyCount = Number(startup.penalty_count) || 0;
  const cleanEvents = Number(startup.clean_events) || 0;
  let isRecovering = false;

  const isAnyNewPenalty = isRateLimited || isSpikeDetected;

  // Note: clean_events is now handled in updateRevenueAndSnapshot for atomic logging
  // But we still need to know its value for recovery calculation
  
  // Decay penalty count over time (reduce by 1 every 15 mins of clean activity)
  // Requirement: Minimum 3 clean events to earn decay
  if (lastPenaltyAt && penaltyCount > 0 && !isAnyNewPenalty && cleanEvents >= 3) {
    const minsSince = (Date.now() - lastPenaltyAt.getTime()) / (1000 * 60);
    const decay = Math.floor(minsSince / 15);
    if (decay > 0) {
      penaltyCount = Math.max(0, penaltyCount - 1); // Only 1 per cycle
      isRecovering = true;
    }
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

  // Apply Stability Penalty with Severity Scaling
  if (isSpikeDetected) {
    const baseSeverity = 0.2;
    const scaledSeverity = Math.min(0.5, baseSeverity + (penaltyCount * 0.05));
    const penalty = score * scaledSeverity;
    score -= penalty;
    breakdown.stability_penalty = -Math.round(penalty);
  }

  // Apply Rate Penalty with Severity Scaling (10%, 20%, 30%+)
  if (isRateLimited) {
    const severity = Math.min(0.5, 0.1 * penaltyCount); 
    const penalty = score * severity;
    score -= penalty;
    breakdown.rate_penalty = -Math.round(penalty);
  }

  // Trust Inertia: If a penalty happened recently (< 10 mins), apply a dampening factor
  const isInertiaActive = lastPenaltyAt && (Date.now() - lastPenaltyAt.getTime()) < 10 * 60 * 1000;
  if (isInertiaActive && !isAnyNewPenalty) {
    const inertiaPenalty = score * 0.15; // 15% dampening of trust
    score -= inertiaPenalty;
    breakdown.inertia_penalty = -Math.round(inertiaPenalty);
  }

  // Trust Recovery Boost: If recovering (penalty_count decayed) and no new penalties
  if (isRecovering && !isAnyNewPenalty) {
    const boostBase = Math.max(1, Math.floor(5 / (penaltyCount + 1))); 
    const recoveryBoost = Math.min(2, boostBase); // Max trust gain per recovery cycle = +2
    score += recoveryBoost;
    breakdown.recovery_boost = recoveryBoost;
  }

  // Final Clamp & Integer Conversion
  score = Math.round(Math.max(0, Math.min(100, score)));
  
  // Compute Tier
  let tier = getTrustTier(score);
  if (maxSeverity >= 4) tier = "flagged";

  // Derive status
  let status: ScoringResult["status"] = "unverified";
  if (maxSeverity >= 4) status = "flagged";
  else if (score >= 70) status = "verified";
  else if (score >= 31) status = "pending";

  // Persist back to DB with penalty state
  const updateData: Record<string, unknown> = {
    trust_score: score,
    trust_tier: tier,
    verification_status: status,
    trust_breakdown: breakdown,
    penalty_count: penaltyCount
  };

  if (isAnyNewPenalty) {
    updateData.last_penalty_at = new Date().toISOString();
  }

  if (options.persist !== false) {
    await supabase
      .from("startup_submissions")
      .update(updateData)
      .eq("id", startup_id);
  }

  return { score, status, tier, updateData };
}
