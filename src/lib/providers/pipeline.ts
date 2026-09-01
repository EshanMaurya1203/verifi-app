import { Provider, RuntimeCredentials, SerializedCredentials } from "./provider";
import { NormalizedPayment } from "./types";
import { supabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";
import { fraudService } from "./services/fraud-service";
import { revenueService } from "./services/revenue-service";
import { normalizeProviderError, ProviderError } from "./errors";
import { handleVerificationCompleted } from "./service";

export interface VerificationPipelineContext {
  startupId: number;
  provider: Provider;
  runtimeCredentials?: RuntimeCredentials;
  // State populated incrementally as the pipeline executes or supplied from resync
  serializedCredentials?: SerializedCredentials;
  transactions?: NormalizedPayment[];
  fraudDetected?: boolean;
  revenueResult?: { revenue: number; currency: string; transactionCount: number };
  aggregatedRevenue?: { totalRevenue: number; breakdown: Record<string, number> };
  snapshotCreated?: boolean;
  trustScoreComputed?: boolean;
}

export interface VerificationPipelineResult {
  success: boolean;
  startupId: number;
  providerId: string;
  revenue?: number;
  breakdown?: Record<string, number>;
  currency?: string;
  totalTransactions?: number;
  fraudDetected?: boolean;
  error?: Error;
}

/**
 * Central Verification Pipeline
 * Orchestrates the execution of shared verification and synchronization logic.
 *
 * This is the canonical execution path for all provider verifications.
 * Stage ordering is strictly fail-closed:
 * 1. Provider authentication
 * 2. Transaction retrieval
 * 3. Fraud detection
 * 4. Transaction persistence
 * 5. Revenue aggregation
 * 6. Revenue snapshot persistence
 * 7. Provider connection persistence
 * 8. Trust-score computation & persistence
 * 9. Mark startup api_verified
 * 10. Verification log persistence
 */
export class VerificationPipeline {
  constructor(private context: VerificationPipelineContext) {}

  /**
   * Executes the full verification pipeline sequentially.
   * The stage ordering is CRITICAL — api_verified is only persisted after
   * all evidence and trust scores have successfully persisted.
   */
  async execute(): Promise<VerificationPipelineResult> {
    try {
      await this.stage1_verifyCredentials();
      await this.stage2_fetchAndNormalizeData();
      await this.stage3_runFraudDetection();
      await this.stage4_upsertTransactions();
      await this.stage5_aggregateRevenue();
      await this.stage6_generateSnapshot();
      await this.stage7_updateConnectionStatus();
      await this.stage8_computeAndPersistTrustScore();
      await this.stage9_markStartupVerified();
      await this.stage10_logEvent();

      return {
        success: true,
        startupId: this.context.startupId,
        providerId: this.context.provider.id,
        revenue: this.context.aggregatedRevenue?.totalRevenue ?? this.context.revenueResult?.revenue,
        breakdown: this.context.aggregatedRevenue?.breakdown,
        currency: this.context.revenueResult?.currency,
        totalTransactions: this.context.transactions?.length,
        fraudDetected: this.context.fraudDetected,
      };
    } catch (error) {
      console.error(
        `[VerificationPipeline] Error executing pipeline for startup ${this.context.startupId}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        success: false,
        startupId: this.context.startupId,
        providerId: this.context.provider.id,
        error: new ProviderError(normalizeProviderError(error)),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline Stages
  // ---------------------------------------------------------------------------

  /**
   * Stage 1: Verify provider credentials
   * Uses RuntimeCredentials (plaintext in memory). Never passed ciphertext.
   */
  private async stage1_verifyCredentials(): Promise<void> {
    if (this.context.runtimeCredentials) {
      const valid = await this.context.provider.verifyCredentials(this.context.runtimeCredentials);
      if (!valid) {
        throw new Error(`Invalid ${this.context.provider.name} API credentials`);
      }
    }
  }

  /**
   * Stage 2: Fetch and normalize provider data
   * Uses RuntimeCredentials to call provider API.
   * Prepares SerializedCredentials for persistence ONLY if not already present.
   */
  private async stage2_fetchAndNormalizeData(): Promise<void> {
    if (!this.context.runtimeCredentials) {
      throw new Error("No runtime credentials available for fetching transactions");
    }

    // Provider API receives ONLY RuntimeCredentials
    const transactions = await this.context.provider.fetchTransactions(
      this.context.runtimeCredentials
    );

    if (transactions.length === 0) {
      throw new Error("No revenue detected in the last 30 days");
    }

    const revenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currency = transactions[0]?.currency || "USD";

    if (revenue === 0) {
      throw new Error("No revenue detected in the last 30 days");
    }

    this.context.transactions = transactions;
    this.context.revenueResult = {
      revenue,
      currency,
      transactionCount: transactions.length,
    };

    // Serialize credentials for encrypted persistence ONLY (if not already supplied by resync)
    if (!this.context.serializedCredentials) {
      this.context.serializedCredentials = await this.context.provider.serializeCredentials(
        this.context.runtimeCredentials
      );
    }
  }

  /**
   * Stage 3: Run fraud detection
   */
  private async stage3_runFraudDetection(): Promise<void> {
    if (!this.context.transactions || this.context.transactions.length === 0) return;

    const amounts = this.context.transactions.map((tx) => tx.amount);
    const currentMaxTx = Math.max(...amounts);

    const result = await fraudService.runChecks({
      startupId: this.context.startupId,
      currentMaxAmount: currentMaxTx,
      insertSignalOnSpike: true,
      signalDescription: `Revenue spike detected via ${this.context.provider.name} verification`,
    });

    this.context.fraudDetected = result.spikeDetected;
  }

  /**
   * Stage 4: Upsert transactions
   * Fail-closed: if any transaction write fails during verification, abort.
   */
  private async stage4_upsertTransactions(): Promise<void> {
    if (!this.context.transactions) return;

    const result = await revenueService.upsertTransactions({
      startupId: this.context.startupId,
      provider: this.context.provider.id,
      transactions: this.context.transactions,
    });

    if (result.failed > 0) {
      const errMsg = result.errors[0]?.message || "Database error";
      throw new Error(
        `Failed to persist ${result.failed} transaction(s) during verification: ${errMsg}`
      );
    }
  }

  /**
   * Stage 5: Aggregate revenue
   */
  private async stage5_aggregateRevenue(): Promise<void> {
    const prefetched: Record<string, any> = {};
    if (this.context.revenueResult) {
      prefetched[this.context.provider.id] = {
        provider: this.context.provider.id,
        originalRevenue: this.context.revenueResult.revenue,
        originalCurrency: this.context.revenueResult.currency,
        revenue: this.context.revenueResult.revenue,
        currency: "INR",
        transactionCount: this.context.revenueResult.transactionCount,
        success: true,
      };
    }
    const aggregated = await revenueService.aggregateRevenue(this.context.startupId, prefetched, true);
    this.context.aggregatedRevenue = aggregated;
  }

  /**
   * Stage 6: Generate revenue snapshot
   * Fail-closed: throws on query or insert failure.
   */
  private async stage6_generateSnapshot(): Promise<void> {
    const snapshotRevenue =
      this.context.aggregatedRevenue?.totalRevenue ??
      this.context.revenueResult?.revenue ??
      0;

    const { data: lastSnap, error: fetchError } = await supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue")
      .eq("startup_id", this.context.startupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      throw new Error(`Failed to query revenue snapshots: ${fetchError.message}`);
    }

    if (!lastSnap?.length || lastSnap[0]?.total_revenue !== snapshotRevenue) {
      const { error: insertError } = await supabaseServer
        .from("revenue_snapshots")
        .insert({
          startup_id: this.context.startupId,
          total_revenue: snapshotRevenue,
          provider_breakdown:
            this.context.aggregatedRevenue?.breakdown || {
              [this.context.provider.id]: snapshotRevenue,
            },
          provider: this.context.provider.id,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new Error(`Failed to insert revenue snapshot: ${insertError.message}`);
      }
      this.context.snapshotCreated = true;
    }
  }

  /**
   * Stage 7: Update provider connection status
   * Fail-closed: throws on upsert error.
   * Persists SerializedCredentials (encryptedKey) only.
   */
  private async stage7_updateConnectionStatus(): Promise<void> {
    const fallbackRevenue = this.context.revenueResult?.revenue ?? 0;
    const providerRevenue =
      this.context.aggregatedRevenue?.breakdown?.[this.context.provider.id] ??
      fallbackRevenue;

    const payload: any = {
      startup_id: this.context.startupId,
      provider: this.context.provider.id,
      latest_revenue: providerRevenue,
      last_synced_at: new Date().toISOString(),
      status: "connected",
    };

    if (this.context.serializedCredentials) {
      payload.account_id = this.context.serializedCredentials.accountId;
      payload.api_key_encrypted = this.context.serializedCredentials.encryptedKey;
    }

    const { error: connError } = await supabaseServer
      .from("provider_connections")
      .upsert(payload, { onConflict: "startup_id,provider" });

    if (connError) {
      throw new Error(`Failed to persist provider connection: ${connError.message}`);
    }
  }

  /**
   * Stage 8: Compute and persist trust score
   * Fail-closed: computeTrustScore throws on persistence failure.
   */
  private async stage8_computeAndPersistTrustScore(): Promise<void> {
    await computeTrustScore(this.context.startupId);
    this.context.trustScoreComputed = true;
  }

  /**
   * Stage 9: Update startup verification status
   * CRITICAL INVARIANT: api_verified is ONLY persisted after all mandatory evidence
   * and trust score persistence have succeeded.
   */
  private async stage9_markStartupVerified(): Promise<void> {
    const payload: any = {
      payment_connected: true,
      verification_status: "api_verified",
      last_verified_at: new Date().toISOString(),
      raw_metrics: {
        payment_count: this.context.transactions?.length ?? 0,
        spike_detected: this.context.fraudDetected ?? false,
      },
    };

    if (this.context.aggregatedRevenue) {
      payload.mrr = Math.round(this.context.aggregatedRevenue.totalRevenue);
      payload.mrr_breakdown = this.context.aggregatedRevenue.breakdown;
    } else if (this.context.revenueResult) {
      payload.mrr = Math.round(this.context.revenueResult.revenue);
      payload.mrr_breakdown = {
        [this.context.provider.id]: this.context.revenueResult.revenue,
      };
    }

    const { error: startupError } = await supabaseServer
      .from("startup_submissions")
      .update(payload)
      .eq("id", this.context.startupId);

    if (startupError) {
      throw new Error(
        `Failed to update startup verification status: ${startupError.message}`
      );
    }
  }

  /**
   * Stage 10: Log verification event
   * Post-certification audit/event record.
   * Does NOT fail verification if log insertion fails, because authoritative
   * verification evidence and status (api_verified) have already succeeded.
   */
  private async stage10_logEvent(): Promise<void> {
    const snapshotRevenue =
      this.context.aggregatedRevenue?.totalRevenue ??
      this.context.revenueResult?.revenue ??
      0;

    try {
      const { data: logRecord, error: logError } = await supabaseServer
        .from("verification_logs")
        .insert({
          startup_id: this.context.startupId,
          event: `${this.context.provider.id}_sync_success`,
          metadata: {
            mrr: snapshotRevenue,
            count: this.context.transactions?.length ?? 0,
          },
        })
        .select("id")
        .maybeSingle();

      if (logError) {
        console.error(
          `[VerificationPipeline] Non-fatal: failed to persist audit verification log for startup ${this.context.startupId}: ${logError.message}`
        );
        return;
      }

      if (logRecord?.id) {
        await handleVerificationCompleted({
          startupId: this.context.startupId,
          verificationLogId: logRecord.id,
        }).catch((err) => {
          console.error(
            "[Pipeline] Best-effort verification completed email failed:",
            err instanceof Error ? err.message : "Unknown error"
          );
        });
      }
    } catch (err) {
      console.error(
        `[VerificationPipeline] Non-fatal error during post-verification event logging for startup ${this.context.startupId}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }
}
