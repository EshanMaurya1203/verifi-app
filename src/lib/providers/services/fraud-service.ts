import { detectFraud } from "@/lib/fraud";
import { supabaseServer } from "@/lib/supabase-server";

export interface FraudServiceCheckRequest {
  startupId: number | string;
  provider?: string;
  currentMaxAmount: number;
  insertSignalOnSpike?: boolean;
  signalDescription?: string;
}

export interface FraudServiceCheckResult {
  isFraud: boolean;
  spikeDetected: boolean;
  rateLimitTriggered: boolean;
  reason?: string;
}

/**
 * Service for centralizing provider-agnostic fraud detection.
 * Orchestrates the existing `detectFraud` logic.
 */
export class FraudService {
  async runChecks(request: FraudServiceCheckRequest): Promise<FraudServiceCheckResult> {
    const { data: history } = await supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", request.startupId)
      .order("created_at", { ascending: false })
      .limit(4);

    const prevTxAmounts = (history ?? []).map(h => Number(h.amount));
    const prevTimestamps = (history ?? []).map(h => new Date(h.created_at).getTime());

    const fraud = detectFraud({
      amount: request.currentMaxAmount,
      previousTransactions: prevTxAmounts,
      timestamps: prevTimestamps,
      now: Date.now(),
    });

    const spikeDetected = fraud.reason === "spike";
    const rateLimitTriggered = fraud.reason === "rate_limit";

    if (spikeDetected && request.insertSignalOnSpike) {
      await supabaseServer.from("fraud_signals").insert({
        startup_id: request.startupId,
        signal_type: "REVENUE_SPIKE",
        severity: 3,
        description: request.signalDescription || `Revenue spike detected via ${request.provider || "API"} verification`,
      });
    }

    return {
      isFraud: fraud.isFraud,
      spikeDetected,
      rateLimitTriggered,
      reason: fraud.reason || undefined,
    };
  }
}

export const fraudService = new FraudService();
