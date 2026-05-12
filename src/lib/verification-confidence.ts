/**
 * Verification Confidence Engine
 *
 * Computes a composite confidence score (0–100) that reflects how reliable
 * the revenue verification data is for a given startup.
 *
 * This module is INDEPENDENT of:
 *   - Trust scoring (scoring.ts)      → holistic startup credibility
 *   - Authenticity (revenue-authenticity.ts) → pattern analysis on events
 *
 * Verification confidence = "How much can we trust the data pipeline itself?"
 *   - Are there enough transactions?
 *   - Is deduplication active?
 *   - Is the provider reliable?
 *   - Are there fraud flags?
 *   - How authentic do the events look?
 */

// ─── Configuration ──────────────────────────────────────────────────────────

/** Weight distribution for confidence components (must sum to 1.0) */
const WEIGHTS = {
  transactionVolume: 0.25,
  providerReliability: 0.20,
  authenticitySignal: 0.25,
  fraudClearance: 0.20,
  deduplication: 0.10,
} as const;

/** Transaction volume score tiers */
const VOLUME_TIERS = [
  { min: 20, score: 100 },
  { min: 10, score: 80 },
  { min: 5, score: 60 },
  { min: 3, score: 40 },
  { min: 1, score: 20 },
  { min: 0, score: 0 },
] as const;

/** Provider reliability baselines (can be extended for new providers) */
const PROVIDER_RELIABILITY: Record<string, number> = {
  stripe: 95,
  razorpay: 90,
};
const DEFAULT_PROVIDER_RELIABILITY = 70;

// ─── Types ──────────────────────────────────────────────────────────────────

export type VerificationStatus = "VERIFIED" | "REVIEWING" | "LOW CONFIDENCE";

export interface VerificationConfidenceInput {
  /** Total number of verified revenue events */
  transactionCount: number;
  /** Connected provider names (e.g. ["stripe", "razorpay"]) */
  providers: string[];
  /** Authenticity score from the Revenue Authenticity Engine (0–100) */
  authenticityScore: number;
  /** Number of fraud signals flagged in the last 30 days */
  fraudFlagCount: number;
  /** Whether the system has deduplication active (stripe_payment_id unique index, etc.) */
  deduplicationActive: boolean;
  /** Last sync timestamp (ISO string or null) */
  lastSyncAt: string | null;
}

export interface VerificationConfidenceResult {
  /** Composite confidence score (0–100) */
  verification_confidence: number;
  /** Number of verified transactions */
  verified_transaction_count: number;
  /** Whether duplicate prevention is active */
  duplicate_protection_active: boolean;
  /** Fraud check status summary */
  fraud_check_status: "passed" | "flagged" | "no_data";
  /** Human-readable verification status */
  verification_status: VerificationStatus;
  /** Per-provider detail for transparency */
  provider_details: {
    provider: string;
    reliability: number;
    last_sync: string | null;
  }[];
}

// ─── Core Engine ────────────────────────────────────────────────────────────

/**
 * Computes the verification confidence score from pipeline signals.
 *
 * Scoring model (weighted average):
 *   1. Transaction volume (25%) — more events = higher confidence
 *   2. Provider reliability (20%) — Stripe/Razorpay track records
 *   3. Authenticity signal  (25%) — passthrough from authenticity engine
 *   4. Fraud clearance     (20%) — fewer fraud flags = higher confidence
 *   5. Deduplication       (10%) — is the pipeline protected from duplicates?
 */
export function computeVerificationConfidence(
  input: VerificationConfidenceInput
): VerificationConfidenceResult {
  const {
    transactionCount,
    providers,
    authenticityScore,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt,
  } = input;

  // ── 1. Transaction Volume Score ───────────────────────────
  let volumeScore = 0;
  for (const tier of VOLUME_TIERS) {
    if (transactionCount >= tier.min) {
      volumeScore = tier.score;
      break;
    }
  }

  // ── 2. Provider Reliability Score ─────────────────────────
  let providerScore = 0;
  if (providers.length > 0) {
    const scores = providers.map(
      (p) => PROVIDER_RELIABILITY[p.toLowerCase()] ?? DEFAULT_PROVIDER_RELIABILITY
    );
    providerScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  // ── 3. Authenticity Signal (passthrough, not duplicated) ──
  const authenticitySignal = Math.max(0, Math.min(100, authenticityScore));

  // ── 4. Fraud Clearance Score ──────────────────────────────
  let fraudScore: number;
  if (fraudFlagCount === 0) {
    fraudScore = 100;
  } else if (fraudFlagCount <= 2) {
    fraudScore = 60;
  } else if (fraudFlagCount <= 5) {
    fraudScore = 30;
  } else {
    fraudScore = 10;
  }

  // ── 5. Deduplication Score ────────────────────────────────
  const dedupScore = deduplicationActive ? 100 : 30;

  // ── Weighted Average ──────────────────────────────────────
  const raw =
    volumeScore * WEIGHTS.transactionVolume +
    providerScore * WEIGHTS.providerReliability +
    authenticitySignal * WEIGHTS.authenticitySignal +
    fraudScore * WEIGHTS.fraudClearance +
    dedupScore * WEIGHTS.deduplication;

  const confidence = Math.round(Math.max(0, Math.min(100, raw)));

  // ── Derive Status ─────────────────────────────────────────
  const status = getVerificationStatus(confidence);

  // ── Fraud Check Status ────────────────────────────────────
  let fraudCheckStatus: "passed" | "flagged" | "no_data";
  if (transactionCount === 0) {
    fraudCheckStatus = "no_data";
  } else if (fraudFlagCount > 0) {
    fraudCheckStatus = "flagged";
  } else {
    fraudCheckStatus = "passed";
  }

  // ── Provider Details ──────────────────────────────────────
  const providerDetails = providers.map((p) => ({
    provider: p,
    reliability: PROVIDER_RELIABILITY[p.toLowerCase()] ?? DEFAULT_PROVIDER_RELIABILITY,
    last_sync: lastSyncAt,
  }));

  return {
    verification_confidence: confidence,
    verified_transaction_count: transactionCount,
    duplicate_protection_active: deduplicationActive,
    fraud_check_status: fraudCheckStatus,
    verification_status: status,
    provider_details: providerDetails,
  };
}

function getVerificationStatus(confidence: number): VerificationStatus {
  if (confidence >= 70) return "VERIFIED";
  if (confidence >= 40) return "REVIEWING";
  return "LOW CONFIDENCE";
}
