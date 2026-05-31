/**
 * Verification Confidence Engine
 *
 * Composite score (0–100) from observable pipeline signals only.
 * Does not assign public verification tiers — see verification-state.ts.
 */

const WEIGHTS = {
  transactionVolume: 0.35,
  providerSync: 0.25,
  consistencySignal: 0.25,
  fraudClearance: 0.15,
} as const;

const VOLUME_TIERS = [
  { min: 20, score: 100 },
  { min: 10, score: 80 },
  { min: 5, score: 60 },
  { min: 3, score: 40 },
  { min: 1, score: 20 },
  { min: 0, score: 0 },
] as const;

const SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export type VerificationStatus = "VERIFIED" | "SYNCING" | "LOW CONFIDENCE";

export interface VerificationConfidenceInput {
  transactionCount: number;
  providers: string[];
  consistencyScore: number;
  fraudFlagCount: number;
  deduplicationActive: boolean;
  lastSyncAt: string | null;
}

export interface VerificationConfidenceResult {
  verification_confidence: number;
  verified_transaction_count: number;
  duplicate_protection_active: boolean;
  fraud_check_status: "passed" | "flagged" | "no_data";
  verification_status: VerificationStatus;
  provider_details: {
    provider: string;
    sync_active: boolean;
    last_sync: string | null;
  }[];
}

function providerSyncScore(
  providers: string[],
  lastSyncAt: string | null
): number {
  if (providers.length === 0) return 0;
  if (!lastSyncAt) return 40;
  const fresh = Date.now() - new Date(lastSyncAt).getTime() <= SYNC_FRESH_MS;
  return fresh ? 100 : 50;
}

export function computeVerificationConfidence(
  input: VerificationConfidenceInput
): VerificationConfidenceResult {
  const {
    transactionCount,
    providers,
    consistencyScore,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt,
  } = input;

  let volumeScore = 0;
  for (const tier of VOLUME_TIERS) {
    if (transactionCount >= tier.min) {
      volumeScore = tier.score;
      break;
    }
  }

  const syncScore = providerSyncScore(providers, lastSyncAt);
  const consistencySignal = Math.max(0, Math.min(100, consistencyScore));

  let fraudScore: number;
  if (transactionCount === 0) {
    fraudScore = 0;
  } else if (fraudFlagCount === 0) {
    fraudScore = 100;
  } else if (fraudFlagCount <= 2) {
    fraudScore = 50;
  } else {
    fraudScore = 20;
  }

  const dedupMultiplier = deduplicationActive ? 1 : 0.85;
  const raw =
    (volumeScore * WEIGHTS.transactionVolume +
      syncScore * WEIGHTS.providerSync +
      consistencySignal * WEIGHTS.consistencySignal +
      fraudScore * WEIGHTS.fraudClearance) *
    dedupMultiplier;

  const confidence = Math.round(Math.max(0, Math.min(100, raw)));

  let fraudCheckStatus: "passed" | "flagged" | "no_data";
  if (transactionCount === 0) {
    fraudCheckStatus = "no_data";
  } else if (fraudFlagCount > 0) {
    fraudCheckStatus = "flagged";
  } else {
    fraudCheckStatus = "passed";
  }

  const providerDetails = providers.map((p) => ({
    provider: p,
    sync_active:
      !!lastSyncAt &&
      Date.now() - new Date(lastSyncAt).getTime() <= SYNC_FRESH_MS,
    last_sync: lastSyncAt,
  }));

  return {
    verification_confidence: confidence,
    verified_transaction_count: transactionCount,
    duplicate_protection_active: deduplicationActive,
    fraud_check_status: fraudCheckStatus,
    verification_status: getVerificationStatus(
      confidence,
      providers.length,
      lastSyncAt
    ),
    provider_details: providerDetails,
  };
}

function getVerificationStatus(
  confidence: number,
  connectedProviderCount: number,
  lastSyncAt: string | null
): VerificationStatus {
  if (connectedProviderCount === 0) return "LOW CONFIDENCE";
  if (!lastSyncAt) return "SYNCING";
  if (confidence >= 70) return "VERIFIED";
  if (confidence >= 40) return "SYNCING";
  return "LOW CONFIDENCE";
}
