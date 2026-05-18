import { computeVerificationConfidence } from "./verification-confidence";
import { analyzeRevenueConsistency } from "./revenue-consistency";
import { calculateTrustScore } from "./scoring";

// ─── Confidence-Based Trust Tiers ───────────────────────────────────────────
//
// Replaces binary approved/rejected with graduated confidence levels:
//   SELF_REPORTED       → No provider connected, MRR self-declared
//   PAYMENT_CONNECTED   → Provider linked, building transaction history
//   REVENUE_VERIFIED    → Consistent revenue data confirmed by provider
//   HIGH_CONFIDENCE     → Strong multi-signal verification, high trust
//
// Internal anomaly states are tracked silently via `internalFlags`
// without exposing scary fraud wording publicly.

export type ConfidenceTier =
  | "SELF_REPORTED"
  | "PAYMENT_CONNECTED"
  | "REVENUE_VERIFIED"
  | "HIGH_CONFIDENCE";

/** Internal-only anomaly flags — never shown publicly */
export type InternalAnomalyFlag =
  | "RATE_LIMIT_TRIGGERED"
  | "REVENUE_SPIKE_DETECTED"
  | "CONSISTENCY_LOW"
  | "PENALTY_ACTIVE"
  | "PROVIDER_STALE";

export interface VerificationStateInput {
  revenueTransactions: { amount: number; timestamp: number }[];
  providerConnections: { provider: string; status: string; last_synced_at: string | null; last_mrr?: number }[];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
}

export interface VerificationStateResult {
  /** Public-facing confidence tier */
  confidenceTier: ConfidenceTier;
  /** Numeric confidence score (0–100) */
  verificationConfidence: number;
  /** Connected provider names */
  providersConnected: string[];
  /** Whether duplicate protection is active */
  duplicateProtectionActive: boolean;
  /** Whether fraud checks passed (internal use) */
  fraudChecksPassed: boolean;
  /** Revenue consistency level label */
  consistencyLevel: string;
  /** Revenue consistency score (0–100) */
  consistencyScore: number;
  /** Consistency analysis flags */
  consistencyFlags: string[];
  /** Overall trust score (0–100) */
  trustScore: number;
  /** Last provider sync timestamp */
  lastSyncAt: string | null;
  /** Number of verified transactions */
  transactionCount: number;
  /** Whether any provider is connected */
  hasConnectedProviders: boolean;
  /** Per-provider MRR breakdown */
  providerBreakdown: { provider: string; amount: number; percentage: number }[];
  /** Depth of verification (1–4) */
  verificationDepth: number;
  /** Internal anomaly flags — never exposed in public UI */
  internalFlags: InternalAnomalyFlag[];

  // ── Backward-compatible aliases ──
  /** @deprecated Use confidenceTier instead */
  verificationStatus: string;
}

// ─── Tier Resolution ────────────────────────────────────────────────────────

function resolveConfidenceTier(
  hasProviders: boolean,
  confidence: number,
  trustScore: number,
  consistencyScore: number,
  transactionCount: number,
): ConfidenceTier {
  // No provider connected → self-reported data only
  if (!hasProviders) {
    return "SELF_REPORTED";
  }

  // Provider connected but low confidence or few transactions
  if (confidence < 50 || transactionCount < 3) {
    return "PAYMENT_CONNECTED";
  }

  // Strong multi-signal verification
  if (confidence >= 75 && trustScore >= 70 && consistencyScore >= 60) {
    return "HIGH_CONFIDENCE";
  }

  // Decent confidence with provider data
  return "REVENUE_VERIFIED";
}

// ─── Internal Anomaly Detection ─────────────────────────────────────────────

function detectInternalAnomalies(
  fraudSignals: { signal_type: string }[],
  penaltyCount: number,
  consistencyScore: number,
  lastSyncAt: string | null,
): InternalAnomalyFlag[] {
  const flags: InternalAnomalyFlag[] = [];

  if (fraudSignals.some(f => f.signal_type === "rate_limit")) {
    flags.push("RATE_LIMIT_TRIGGERED");
  }
  if (fraudSignals.some(f => f.signal_type === "revenue_spike")) {
    flags.push("REVENUE_SPIKE_DETECTED");
  }
  if (consistencyScore < 30 && consistencyScore > 0) {
    flags.push("CONSISTENCY_LOW");
  }
  if (penaltyCount > 0) {
    flags.push("PENALTY_ACTIVE");
  }
  if (lastSyncAt) {
    const staleThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    if (new Date(lastSyncAt).getTime() < staleThreshold) {
      flags.push("PROVIDER_STALE");
    }
  }

  return flags;
}

// ─── Core Engine ────────────────────────────────────────────────────────────

export function computeVerificationState(input: VerificationStateInput): VerificationStateResult {
  const activeProviders = input.providerConnections
    .filter(p => p.status === "connected")
    .map(p => p.provider);

  const latestSync = input.providerConnections
    .map(p => p.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop() || null;

  const fraudFlagCount = input.fraudSignals.length;
  
  const fraudMetrics = {
    rate_limit_violations: input.fraudSignals.filter(f => f.signal_type === 'rate_limit').length,
    spike_events: input.fraudSignals.filter(f => f.signal_type === 'revenue_spike').length,
    penalty_count: input.penaltyCount
  };

  const trustResult = calculateTrustScore(input.revenueTransactions, fraudMetrics);
  const authResult = analyzeRevenueConsistency(input.revenueTransactions);
  
  const deduplicationActive = activeProviders.length > 0;

  const confResult = computeVerificationConfidence({
    transactionCount: input.revenueTransactions.length,
    providers: activeProviders,
    consistencyScore: authResult.consistency_score,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt: latestSync,
  });

  const fraudChecksPassed = fraudFlagCount === 0 && input.revenueTransactions.length > 0;
  const hasProviders = activeProviders.length > 0;

  // ── Resolve confidence tier ──
  const confidenceTier = resolveConfidenceTier(
    hasProviders,
    confResult.verification_confidence,
    trustResult,
    authResult.consistency_score,
    input.revenueTransactions.length,
  );

  // ── Detect internal anomalies (never shown publicly) ──
  const internalFlags = detectInternalAnomalies(
    input.fraudSignals,
    input.penaltyCount,
    authResult.consistency_score,
    latestSync,
  );

  // ── Verification depth (1–4 matching tier progression) ──
  const depthMap: Record<ConfidenceTier, number> = {
    SELF_REPORTED: 1,
    PAYMENT_CONNECTED: 2,
    REVENUE_VERIFIED: 3,
    HIGH_CONFIDENCE: 4,
  };

  const result: VerificationStateResult = {
    confidenceTier,
    verificationConfidence: confResult.verification_confidence,
    providersConnected: activeProviders,
    duplicateProtectionActive: deduplicationActive,
    fraudChecksPassed,
    consistencyLevel: authResult.consistency_level,
    consistencyScore: authResult.consistency_score,
    consistencyFlags: authResult.consistency_flags,
    trustScore: trustResult,
    lastSyncAt: latestSync,
    transactionCount: input.revenueTransactions.length,
    hasConnectedProviders: hasProviders,
    providerBreakdown: input.providerConnections
      .filter(p => p.status === "connected")
      .map(p => ({
        provider: p.provider,
        amount: p.last_mrr || 0,
        percentage: 0
      })),
    verificationDepth: depthMap[confidenceTier],
    internalFlags,
    // backward compat
    verificationStatus: confidenceTier,
  };

  // Calculate percentages
  const totalMrr = result.providerBreakdown.reduce((acc, p) => acc + p.amount, 0);
  if (totalMrr > 0) {
    result.providerBreakdown = result.providerBreakdown.map(p => ({
      ...p,
      percentage: Math.round((p.amount / totalMrr) * 100)
    }));
  }

  return result;
}
