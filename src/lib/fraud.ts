/**
 * Unified Fraud Detection Module
 * Deterministic logic for identifying suspicious transaction patterns.
 */

export interface FraudInput {
  amount: number;
  previousTransactions: number[]; // Array of transaction amounts
  timestamps: number[];           // Array of transaction timestamps (ms)
  now: number;                    // Reference time for determinism
}

export interface FraudResult {
  isFraud: boolean;
  reason: "rate_limit" | "spike" | null;
  penalty: number;
}

/**
 * Detects potential fraud based on transaction frequency and amount spikes.
 */
export function detectFraud(input: FraudInput): FraudResult {
  const { amount, previousTransactions, timestamps, now } = input;
  const WINDOW_MS = 120000; // 2 minutes

  let result: FraudResult = {
    isFraud: false,
    reason: null,
    penalty: 0,
  };

  // 1. Rate limit check
  if (timestamps.length > 0) {
    const recentTransactionsCount = timestamps.filter(
      (t) => now - t < WINDOW_MS
    ).length;

    if (recentTransactionsCount >= 2) {
      result = { isFraud: true, reason: "rate_limit", penalty: 20 };
    }
  }

  // 2. Spike detection
  if (!result.isFraud && previousTransactions.length >= 4) {
    const last4 = previousTransactions.slice(-4);
    const average = last4.reduce((sum, val) => sum + val, 0) / last4.length;

    if (amount > average * 3) {
      result = { isFraud: true, reason: "spike", penalty: 15 };
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[FRAUD CHECK]", {
      amount,
      isFraud: result.isFraud,
      reason: result.reason,
    });
  }

  return result;
}
