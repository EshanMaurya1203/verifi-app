import { computeVerificationConfidence } from "./verification-confidence";
import { analyzeRevenueConsistency } from "./revenue-consistency";
import { calculateTrustScore } from "./scoring";

// ─── Confidence-Based Trust Tiers (data-derived only) ───────────────────────
//
//   SELF_REPORTED     → No connected payment provider
//   PAYMENT_CONNECTED → Provider linked; insufficient provider-backed revenue history
//   REVENUE_VERIFIED  → Provider linked + transaction history + recent sync

export type ConfidenceTier =
  | "SELF_REPORTED"
  | "PAYMENT_CONNECTED"
  | "REVENUE_VERIFIED";

/** @deprecated Use REVENUE_VERIFIED — kept for callers not yet updated */
export type LegacyConfidenceTier = ConfidenceTier | "HIGH_CONFIDENCE";

export type InternalAnomalyFlag =
  | "RATE_LIMIT_TRIGGERED"
  | "REVENUE_SPIKE_DETECTED"
  | "CONSISTENCY_LOW"
  | "PENALTY_ACTIVE"
  | "PROVIDER_STALE";

export interface VerificationStateInput {
  revenueTransactions: { amount: number; timestamp: number }[];
  providerConnections: {
    provider: string;
    status: string;
    last_synced_at: string | null;
    latest_revenue?: number;
  }[];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  /** Sandbox/demo profiles must not inherit simulated DB metrics as verified */
  isDemoProfile?: boolean;
  /** From startup_submissions.verification_type (api, manual, proof, social) */
  verificationType?: string | null;
  hasProofUpload?: boolean;
}

export interface VerificationStateResult {
  confidenceTier: ConfidenceTier;
  verificationConfidence: number;
  providersConnected: string[];
  duplicateProtectionActive: boolean;
  fraudChecksPassed: boolean;
  consistencyLevel: string;
  consistencyScore: number;
  consistencyFlags: string[];
  trustScore: number;
  lastSyncAt: string | null;
  transactionCount: number;
  hasConnectedProviders: boolean;
  providerBreakdown: { provider: string; amount: number; percentage: number }[];
  verificationDepth: number;
  internalFlags: InternalAnomalyFlag[];
  /** @deprecated Use confidenceTier */
  verificationStatus: string;
  /** Submission verification_type */
  verificationMethod: string;
  verificationMethodLabel: string;
  /** Primary revenue evidence channel */
  dataSource: string;
  dataSourceLabel: string;
  /** Provider-backed revenue with recent sync — required before "verified" UI */
  hasVerificationEvidence: boolean;
}

const MIN_PROVIDER_TRANSACTIONS = 3;
const SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function formatLastSyncRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatVerificationMethodLabel(
  verificationType: string | null | undefined
): string {
  switch (verificationType?.toLowerCase()) {
    case "api":
      return "Payment API";
    case "proof":
      return "Proof upload";
    case "social":
      return "Social links";
    case "manual":
      return "Manual declaration";
    default:
      return "Manual declaration";
  }
}

export function resolveTrustDataSource(params: {
  confidenceTier: ConfidenceTier;
  providersConnected: string[];
  verificationType?: string | null;
  hasProofUpload?: boolean;
  isDemoProfile?: boolean;
}): { dataSource: string; dataSourceLabel: string } {
  if (params.isDemoProfile) {
    return { dataSource: "sandbox", dataSourceLabel: "Sandbox sample data" };
  }

  if (params.providersConnected.length > 0) {
    const names = params.providersConnected.map(
      (p) => p.charAt(0).toUpperCase() + p.slice(1)
    );
    const label =
      params.confidenceTier === "REVENUE_VERIFIED"
        ? names.join(" + ")
        : `${names.join(" + ")} (awaiting sync)`;
    return { dataSource: params.providersConnected[0], dataSourceLabel: label };
  }

  if (params.hasProofUpload || params.verificationType === "proof") {
    return {
      dataSource: "proof",
      dataSourceLabel: "Uploaded proof (not ledger-backed)",
    };
  }

  if (params.verificationType === "api") {
    return {
      dataSource: "pending_api",
      dataSourceLabel: "Payment API (not connected)",
    };
  }

  return {
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
  };
}

export function hasVerificationEvidence(
  state: Pick<VerificationStateResult, "confidenceTier">
): boolean {
  return state.confidenceTier === "REVENUE_VERIFIED";
}

function normalizeSignalType(signal: string): string {
  return signal.toLowerCase().replace(/_/g, "");
}

function sumTransactionAmounts(
  transactions: { amount: number; timestamp: number }[]
): number {
  return transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

function hasDuplicateProtection(
  transactions: { amount: number; timestamp: number }[]
): boolean {
  if (transactions.length < 2) return false;
  const keys = new Set(
    transactions.map((t) => `${t.timestamp}:${Number(t.amount)}`)
  );
  return keys.size >= 2;
}

/**
 * Tier rules use only observable pipeline data (no trust-score or reliability priors).
 */
export function resolveConfidenceTierFromData(params: {
  hasProviders: boolean;
  transactionCount: number;
  providerRevenueTotal: number;
  lastSyncAt: string | null;
}): ConfidenceTier {
  if (!params.hasProviders) {
    return "SELF_REPORTED";
  }

  const syncFresh =
    !!params.lastSyncAt &&
    Date.now() - new Date(params.lastSyncAt).getTime() <= SYNC_FRESH_MS;

  const hasProviderRevenueHistory =
    params.transactionCount >= MIN_PROVIDER_TRANSACTIONS &&
    params.providerRevenueTotal > 0;

  if (hasProviderRevenueHistory && syncFresh) {
    return "REVENUE_VERIFIED";
  }

  return "PAYMENT_CONNECTED";
}

function detectInternalAnomalies(
  fraudSignals: { signal_type: string }[],
  penaltyCount: number,
  consistencyScore: number,
  lastSyncAt: string | null
): InternalAnomalyFlag[] {
  const flags: InternalAnomalyFlag[] = [];

  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("ratelimit"))
  ) {
    flags.push("RATE_LIMIT_TRIGGERED");
  }
  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("spike"))
  ) {
    flags.push("REVENUE_SPIKE_DETECTED");
  }
  if (consistencyScore < 30 && consistencyScore > 0) {
    flags.push("CONSISTENCY_LOW");
  }
  if (penaltyCount > 0) {
    flags.push("PENALTY_ACTIVE");
  }
  if (lastSyncAt) {
    const staleThreshold = Date.now() - SYNC_FRESH_MS;
    if (new Date(lastSyncAt).getTime() < staleThreshold) {
      flags.push("PROVIDER_STALE");
    }
  }

  return flags;
}

function selfReportedResult(
  penaltyCount: number,
  fraudSignals: { signal_type: string }[],
  verificationType?: string | null,
  hasProofUpload?: boolean,
  isDemoProfile?: boolean
): VerificationStateResult {
  const method = verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: "SELF_REPORTED",
    providersConnected: [],
    verificationType: method,
    hasProofUpload,
    isDemoProfile,
  });

  return {
    confidenceTier: "SELF_REPORTED",
    verificationConfidence: 0,
    providersConnected: [],
    duplicateProtectionActive: false,
    fraudChecksPassed: false,
    consistencyLevel: "Refining",
    consistencyScore: 0,
    consistencyFlags: [],
    trustScore: 0,
    lastSyncAt: null,
    transactionCount: 0,
    hasConnectedProviders: false,
    providerBreakdown: [],
    verificationDepth: 1,
    internalFlags: detectInternalAnomalies(fraudSignals, penaltyCount, 0, null),
    verificationStatus: "SELF_REPORTED",
    verificationMethod: method,
    verificationMethodLabel: formatVerificationMethodLabel(method),
    dataSource,
    dataSourceLabel,
    hasVerificationEvidence: false,
  };
}

export function computeVerificationState(
  input: VerificationStateInput
): VerificationStateResult {
  if (input.isDemoProfile) {
    return selfReportedResult(
      input.penaltyCount,
      input.fraudSignals,
      input.verificationType,
      input.hasProofUpload,
      true
    );
  }

  const activeProviders = input.providerConnections
    .filter((p) => p.status === "connected")
    .map((p) => p.provider);

  const latestSync =
    input.providerConnections
      .map((p) => p.last_synced_at)
      .filter(Boolean)
      .sort()
      .pop() || null;

  const fraudFlagCount = input.fraudSignals.length;
  const fraudMetrics = {
    rate_limit_violations: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("ratelimit")
    ).length,
    spike_events: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("spike")
    ).length,
    penalty_count: input.penaltyCount,
  };

  const trustResult = calculateTrustScore(
    input.revenueTransactions,
    fraudMetrics
  );
  const authResult = analyzeRevenueConsistency(input.revenueTransactions);
  const deduplicationActive = hasDuplicateProtection(input.revenueTransactions);
  const hasProviders = activeProviders.length > 0;
  const providerRevenueTotal = sumTransactionAmounts(input.revenueTransactions);

  const confResult = computeVerificationConfidence({
    transactionCount: input.revenueTransactions.length,
    providers: activeProviders,
    consistencyScore: authResult.consistency_score,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt: latestSync,
  });

  const confidenceTier = resolveConfidenceTierFromData({
    hasProviders,
    transactionCount: input.revenueTransactions.length,
    providerRevenueTotal,
    lastSyncAt: latestSync,
  });

  const fraudChecksPassed =
    fraudFlagCount === 0 &&
    input.revenueTransactions.length > 0 &&
    hasProviders;

  const internalFlags = detectInternalAnomalies(
    input.fraudSignals,
    input.penaltyCount,
    authResult.consistency_score,
    latestSync
  );

  const depthMap: Record<ConfidenceTier, number> = {
    SELF_REPORTED: 1,
    PAYMENT_CONNECTED: 2,
    REVENUE_VERIFIED: 3,
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
      .filter((p) => p.status === "connected")
      .map((p) => ({
        provider: p.provider,
        amount: Number(p.latest_revenue) || 0,
        percentage: 0,
      })),
    verificationDepth: depthMap[confidenceTier],
    internalFlags,
    verificationStatus: confidenceTier,
    verificationMethod: "manual",
    verificationMethodLabel: "Manual declaration",
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
    hasVerificationEvidence: confidenceTier === "REVENUE_VERIFIED",
  };

  const totalMrr = result.providerBreakdown.reduce((acc, p) => acc + p.amount, 0);
  if (totalMrr > 0) {
    result.providerBreakdown = result.providerBreakdown.map((p) => ({
      ...p,
      percentage: Math.round((p.amount / totalMrr) * 100),
    }));
  }

  const verificationMethod = input.verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: result.confidenceTier,
    providersConnected: result.providersConnected,
    verificationType: verificationMethod,
    hasProofUpload: input.hasProofUpload,
    isDemoProfile: false,
  });

  result.verificationMethod = verificationMethod;
  result.verificationMethodLabel = formatVerificationMethodLabel(verificationMethod);
  result.dataSource = dataSource;
  result.dataSourceLabel = dataSourceLabel;
  result.hasVerificationEvidence = result.confidenceTier === "REVENUE_VERIFIED";

  return result;
}

/** True only when provider-backed revenue has a recent sync (evidence-backed). */
export function isVerifiedConfidenceTier(tier: ConfidenceTier): boolean {
  return tier === "REVENUE_VERIFIED";
}

export function buildVerificationStateInput(params: {
  revenueTransactions: { amount: number; created_at: string }[];
  providerConnections: VerificationStateInput["providerConnections"];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  isDemoProfile?: boolean;
  verificationType?: string | null;
  hasProofUpload?: boolean;
}): VerificationStateInput {
  return {
    revenueTransactions: params.revenueTransactions.map((event) => ({
      amount: Number(event.amount) || 0,
      timestamp: new Date(event.created_at).getTime(),
    })),
    providerConnections: params.providerConnections,
    fraudSignals: params.fraudSignals,
    penaltyCount: params.penaltyCount,
    isDemoProfile: params.isDemoProfile,
    verificationType: params.verificationType,
    hasProofUpload: params.hasProofUpload,
  };
}
