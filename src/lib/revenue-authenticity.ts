/**
 * Revenue Authenticity Engine
 *
 * Analyzes revenue_events to determine whether a startup's payment history
 * looks organic or synthetically generated.
 *
 * Input:  Array of { amount, timestamp } from the revenue_events table
 * Output: { authenticity_score, authenticity_flags, authenticity_level }
 *
 * This module is INDEPENDENT of the trust scoring engine (scoring.ts).
 * Trust scoring = holistic startup credibility (payments + identity + video + fraud signals).
 * Authenticity  = statistical analysis of revenue event patterns only.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

/** Minimum events required before analysis is meaningful */
const MIN_EVENTS_FOR_ANALYSIS = 4;

/** Percentage of events that share the most common amount to trigger a flag */
const REPEAT_AMOUNT_THRESHOLD = 0.6;

/** Maximum gap CV (coefficient of variation) below which timestamps are "clustered" */
const CLUSTER_GAP_CV_THRESHOLD = 0.15;

/** Minimum gap CV to earn the organic spacing bonus */
const ORGANIC_GAP_CV_MIN = 0.4;

/** Burst detection: max window (ms) and min events within it */
const BURST_WINDOW_MS = 60_000; // 1 minute
const BURST_MIN_EVENTS = 3;

/** Amount diversity: ratio of unique amounts / total events */
const LOW_DIVERSITY_THRESHOLD = 0.3;
const HIGH_DIVERSITY_THRESHOLD = 0.7;

/** Growth consistency: min R² for a positive-slope linear fit */
const GROWTH_R2_THRESHOLD = 0.5;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RevenueEvent {
  amount: number;
  timestamp: number;
}

export type AuthenticityLevel = "Needs Review" | "Moderate" | "Organic";

export interface AuthenticityResult {
  authenticity_score: number;
  authenticity_flags: string[];
  authenticity_level: AuthenticityLevel;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function computeGaps(sorted: RevenueEvent[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
  }
  return gaps;
}

/**
 * Simple linear regression returning slope and R² (coefficient of determination).
 */
function linearRegression(xs: number[], ys: number[]): { slope: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, r2: 0 };

  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const r2 = ssXX !== 0 && ssYY !== 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  return { slope, r2 };
}

// ─── Core Engine ────────────────────────────────────────────────────────────

/**
 * Analyzes an array of revenue events and returns an authenticity assessment.
 *
 * Scoring model (additive from base 60):
 *   Penalties (reduce score):
 *     - Repeated identical payments  → up to -25
 *     - Clustered timestamps         → up to -20
 *     - Low amount diversity         → up to -15
 *     - Burst transactions           → -10 per burst
 *   Bonuses (increase score):
 *     - Organic timestamp spacing    → up to +15
 *     - High amount diversity        → up to +10
 *     - Consistent growth trend      → up to +15
 */
export function analyzeRevenueAuthenticity(events: RevenueEvent[]): AuthenticityResult {
  // ── Edge case: insufficient data ──────────────────────────
  if (!events || events.length < MIN_EVENTS_FOR_ANALYSIS) {
    return {
      authenticity_score: 50,
      authenticity_flags: events?.length
        ? ["Insufficient event history for reliable analysis"]
        : ["No revenue events recorded"],
      authenticity_level: "Moderate",
    };
  }

  const flags: string[] = [];
  let score = 60; // Neutral starting point

  // Sort chronologically
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const amounts = sorted.map((e) => Number(e.amount));
  const totalEvents = sorted.length;

  // ── 1. Repeated Identical Amounts ─────────────────────────
  const freqMap = new Map<number, number>();
  for (const amt of amounts) {
    freqMap.set(amt, (freqMap.get(amt) || 0) + 1);
  }
  const maxFreq = Math.max(...freqMap.values());
  const repeatRatio = maxFreq / totalEvents;

  if (repeatRatio >= REPEAT_AMOUNT_THRESHOLD) {
    const penalty = Math.round(25 * ((repeatRatio - REPEAT_AMOUNT_THRESHOLD) / (1 - REPEAT_AMOUNT_THRESHOLD)));
    const adjustedPenalty = Math.max(8, Math.min(25, penalty + 8));
    score -= adjustedPenalty;
    const topAmount = [...freqMap.entries()].sort((a, b) => b[1] - a[1])[0];
    flags.push(
      `${Math.round(repeatRatio * 100)}% of payments are identical (₹${topAmount[0].toLocaleString()})`
    );
  }

  // ── 2. Timestamp Clustering / Burst Detection ─────────────
  const gaps = computeGaps(sorted);

  if (gaps.length > 0) {
    const gapCV = coefficientOfVariation(gaps);

    // 2a. Fixed-interval penalty (robotic timing)
    if (gapCV < CLUSTER_GAP_CV_THRESHOLD) {
      score -= 20;
      flags.push("Transaction timestamps are highly uniform");
    } else if (gapCV < 0.3) {
      score -= 10;
      flags.push("Stable variation in payment timing");
    }

    // 2b. Burst detection (many events in a short window)
    let burstCount = 0;
    for (let i = 0; i <= sorted.length - BURST_MIN_EVENTS; i++) {
      const windowEnd = sorted[i].timestamp + BURST_WINDOW_MS;
      let inWindow = 0;
      for (let j = i; j < sorted.length && sorted[j].timestamp <= windowEnd; j++) {
        inWindow++;
      }
      if (inWindow >= BURST_MIN_EVENTS) {
        burstCount++;
        // Skip ahead to avoid double-counting overlapping bursts
        i += inWindow - 1;
      }
    }

    if (burstCount > 0) {
      const burstPenalty = Math.min(20, burstCount * 10);
      score -= burstPenalty;
      flags.push(
        `${burstCount} transaction burst${burstCount > 1 ? "s" : ""} detected (${BURST_MIN_EVENTS}+ events within ${BURST_WINDOW_MS / 1000}s)`
      );
    }

    // 2c. Organic spacing bonus
    if (gapCV >= ORGANIC_GAP_CV_MIN && burstCount === 0) {
      const bonus = Math.min(15, Math.round((gapCV - ORGANIC_GAP_CV_MIN) * 25));
      score += bonus;
      flags.push("Natural, organic payment spacing verified");
    }
  }

  // ── 3. Amount Diversity ───────────────────────────────────
  const uniqueAmounts = new Set(amounts).size;
  const diversityRatio = uniqueAmounts / totalEvents;

  if (diversityRatio < LOW_DIVERSITY_THRESHOLD) {
    score -= 15;
    flags.push(`Very low amount diversity (${uniqueAmounts} unique out of ${totalEvents} events)`);
  } else if (diversityRatio >= HIGH_DIVERSITY_THRESHOLD) {
    score += 10;
    flags.push("Healthy amount diversity across payments");
  }

  // ── 4. Amount Variance ────────────────────────────────────
  const amountCV = coefficientOfVariation(amounts);
  if (amountCV < 0.05 && totalEvents >= 6) {
    score -= 10;
    flags.push("Near-zero variance in payment amounts");
  }

  // ── 5. Consistent Growth Trend ────────────────────────────
  if (totalEvents >= 6) {
    const indices = amounts.map((_, i) => i);
    const { slope, r2 } = linearRegression(indices, amounts);

    if (slope > 0 && r2 >= GROWTH_R2_THRESHOLD) {
      const bonus = Math.min(15, Math.round(r2 * 15));
      score += bonus;
      flags.push("Consistent upward revenue growth detected");
    }
  }

  // ── Clamp & Classify ──────────────────────────────────────
  const finalScore = Math.round(Math.max(0, Math.min(100, score)));
  const level = getAuthenticityLevel(finalScore);

  return {
    authenticity_score: finalScore,
    authenticity_flags: flags.slice(0, 6), // Keep concise
    authenticity_level: level,
  };
}

function getAuthenticityLevel(score: number): AuthenticityLevel {
  if (score < 30) return "Needs Review";
  if (score < 60) return "Moderate";
  return "Organic";
}
