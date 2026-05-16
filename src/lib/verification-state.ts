import { computeVerificationConfidence } from "./verification-confidence";
import { analyzeRevenueAuthenticity } from "./revenue-authenticity";
import { calculateTrustScore } from "./scoring";

export type UnifiedVerificationStatus = "VERIFIED" | "PARTIALLY VERIFIED" | "REVIEWING" | "NEEDS REVIEW" | "INCOMPLETE" | "MONITORING" | "UNVERIFIED";

export interface VerificationStateInput {
  revenueTransactions: { amount: number; timestamp: number }[];
  providerConnections: { provider: string; status: string; last_synced_at: string | null; last_mrr?: number }[];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
}

export interface VerificationStateResult {
  verificationStatus: UnifiedVerificationStatus;
  providersConnected: string[];
  duplicateProtectionActive: boolean;
  fraudChecksPassed: boolean;
  verificationConfidence: number;
  authenticityLevel: string;
  authenticityScore: number;
  authenticityFlags: string[];
  trustScore: number;
  lastSyncAt: string | null;
  transactionCount: number;
  hasConnectedProviders: boolean;
  providerBreakdown: { provider: string; amount: number; percentage: number }[];
  verificationDepth: number;
}

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
  const authResult = analyzeRevenueAuthenticity(input.revenueTransactions);
  
  const deduplicationActive = activeProviders.length > 0;

  const confResult = computeVerificationConfidence({
    transactionCount: input.revenueTransactions.length,
    providers: activeProviders,
    authenticityScore: authResult.authenticity_score,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt: latestSync,
  });

  const fraudChecksPassed = fraudFlagCount === 0 && input.revenueTransactions.length > 0;

  let verificationStatus: UnifiedVerificationStatus = "REVIEWING";
  if (activeProviders.length === 0) {
    verificationStatus = "REVIEWING";
  } else if (confResult.verification_confidence >= 80) {
    verificationStatus = "VERIFIED";
  } else if (confResult.verification_confidence >= 50) {
    verificationStatus = "PARTIALLY VERIFIED";
  } else {
    verificationStatus = "NEEDS REVIEW";
  }

  const result: VerificationStateResult = {
    verificationStatus,
    providersConnected: activeProviders,
    duplicateProtectionActive: deduplicationActive,
    fraudChecksPassed,
    verificationConfidence: confResult.verification_confidence,
    authenticityLevel: authResult.authenticity_level,
    authenticityScore: authResult.authenticity_score,
    authenticityFlags: authResult.authenticity_flags,
    trustScore: trustResult,
    lastSyncAt: latestSync,
    transactionCount: input.revenueTransactions.length,
    hasConnectedProviders: activeProviders.length > 0,
    providerBreakdown: input.providerConnections
      .filter(p => p.status === "connected")
      .map(p => ({
        provider: p.provider,
        amount: p.last_mrr || 0,
        percentage: 0 // Will calculate below
      })),
    verificationDepth: activeProviders.length > 0 
      ? (confResult.verification_confidence > 90 ? 4 : confResult.verification_confidence > 70 ? 3 : 2)
      : 1
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
