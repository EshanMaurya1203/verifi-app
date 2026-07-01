import { Provider, ProviderCredentials } from "./provider";
import { NormalizedPayment } from "./types";
import { supabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";
import { fraudService } from "./services/fraud-service";
import { revenueService } from "./services/revenue-service";

export interface VerificationPipelineContext {
  startupId: number;
  provider: Provider;
  rawCredentials?: ProviderCredentials;
  // State populated incrementally as the pipeline executes
  serializedCredentials?: { accountId: string; encryptedKey: string };
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
 * Razorpay is the reference implementation; Stripe will follow.
 */
export class VerificationPipeline {
  constructor(private context: VerificationPipelineContext) {}

  /**
   * Executes the full verification pipeline sequentially.
   * The stage ordering is CRITICAL — do not reorder.
   */
  async execute(): Promise<VerificationPipelineResult> {
    try {
      await this.stage1_verifyCredentials();
      await this.stage2_normalizeData();
      await this.stage3_runFraudDetection();
      await this.stage4_upsertTransactions();
      await this.stage5_aggregateRevenue();
      await this.stage6_generateSnapshot();
      await this.stage7_computeTrustScore();
      await this.stage8_updateConnectionStatus();
      await this.stage9_updateStartupStatus();
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
      console.error(`[VerificationPipeline] Error executing pipeline for startup ${this.context.startupId}:`, error);
      return {
        success: false,
        startupId: this.context.startupId,
        providerId: this.context.provider.id,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline Stages
  // ---------------------------------------------------------------------------

  /**
   * Stage 1: Verify provider credentials
   * If rawCredentials are provided, validate them via the provider.
   * If not (resync case), credentials were already verified previously.
   */
  private async stage1_verifyCredentials(): Promise<void> {
    if (this.context.rawCredentials) {
      const valid = await this.context.provider.verifyCredentials(this.context.rawCredentials);
      if (!valid) {
        throw new Error(`Invalid ${this.context.provider.name} API credentials`);
      }
    }
  }

  /**
   * Stage 2: Normalize provider data
   * Serialize credentials and fetch normalized transactions.
   */
  private async stage2_normalizeData(): Promise<void> {
    // Serialize credentials if raw ones were provided
    if (this.context.rawCredentials) {
      this.context.serializedCredentials = await this.context.provider.serializeCredentials(
        this.context.rawCredentials
      );
    }

    if (!this.context.serializedCredentials) {
      throw new Error("No credentials available for fetching transactions");
    }

    const { accountId, encryptedKey } = this.context.serializedCredentials;

    // For fetchTransactions we need the decrypted key — but we receive it
    // already decrypted from the caller (resync) or from raw credentials.
    // The pipeline context stores the decrypted key for fetching.
    // We use a convention: if rawCredentials exist, pass the raw secret;
    // otherwise the caller must supply serializedCredentials with the decrypted key
    // stored temporarily in encryptedKey field for the fetch call.
    const transactions = await this.context.provider.fetchTransactions(
      accountId,
      encryptedKey
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
  }

  /**
   * Stage 3: Run fraud detection
   */
  private async stage3_runFraudDetection(): Promise<void> {
    if (!this.context.transactions || this.context.transactions.length === 0) return;

    const amounts = this.context.transactions.map(tx => tx.amount);
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
   */
  private async stage4_upsertTransactions(): Promise<void> {
    if (!this.context.transactions) return;

    const result = await revenueService.upsertTransactions({
      startupId: this.context.startupId,
      provider: this.context.provider.id,
      transactions: this.context.transactions,
    });
    
    if (result.failed > 0) {
      console.warn(`[VerificationPipeline] ${result.failed} transactions failed to insert for startup ${this.context.startupId}. Errors:`, result.errors);
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
   * Mirrors the exact logic from the existing sync files.
   */
  private async stage6_generateSnapshot(): Promise<void> {
    const snapshotRevenue = this.context.aggregatedRevenue?.totalRevenue
      ?? this.context.revenueResult?.revenue
      ?? 0;

    const { data: lastSnap } = await supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue")
      .eq("startup_id", this.context.startupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!lastSnap?.length || lastSnap[0]?.total_revenue !== snapshotRevenue) {
      await supabaseServer.from("revenue_snapshots").insert({
        startup_id: this.context.startupId,
        total_revenue: snapshotRevenue,
        provider_breakdown:
          this.context.aggregatedRevenue?.breakdown || { [this.context.provider.id]: snapshotRevenue },
        provider: this.context.provider.id,
        created_at: new Date().toISOString(),
      });
      this.context.snapshotCreated = true;
    }
  }

  /**
   * Stage 7: Compute trust score
   */
  private async stage7_computeTrustScore(): Promise<void> {
    await computeTrustScore(this.context.startupId);
    this.context.trustScoreComputed = true;
  }

  /**
   * Stage 8: Update provider connection status
   */
  private async stage8_updateConnectionStatus(): Promise<void> {
    const fallbackRevenue = this.context.revenueResult?.revenue ?? 0;
    const providerRevenue = this.context.aggregatedRevenue?.breakdown?.[this.context.provider.id] ?? fallbackRevenue;

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

    await supabaseServer
      .from("provider_connections")
      .upsert(payload, { onConflict: "startup_id,provider" });
  }

  /**
   * Stage 9: Update startup verification status
   */
  private async stage9_updateStartupStatus(): Promise<void> {
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
      payload.mrr_breakdown = { [this.context.provider.id]: this.context.revenueResult.revenue };
    }

    await supabaseServer
      .from("startup_submissions")
      .update(payload)
      .eq("id", this.context.startupId);
  }

  /**
   * Stage 10: Log verification event
   */
  private async stage10_logEvent(): Promise<void> {
    const snapshotRevenue = this.context.aggregatedRevenue?.totalRevenue
      ?? this.context.revenueResult?.revenue
      ?? 0;

    await supabaseServer.from("verification_logs").insert({
      startup_id: this.context.startupId,
      event: `${this.context.provider.id}_sync_success`,
      metadata: {
        mrr: snapshotRevenue,
        count: this.context.transactions?.length ?? 0,
      },
    });
  }
}

