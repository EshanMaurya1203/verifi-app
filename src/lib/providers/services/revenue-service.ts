import { supabaseServer } from "@/lib/supabase-server";
import { getAggregatedRevenue, ProviderRevenue } from "@/lib/revenue-aggregation";
import { NormalizedPayment } from "../types";

export interface UpsertTransactionsRequest {
  startupId: number | string;
  provider: string;
  transactions: NormalizedPayment[];
}

export interface UpsertTransactionsResult {
  successful: number;
  failed: number;
  errors: any[];
}

export interface AggregateRevenueResult {
  totalRevenue: number;
  breakdown: Record<string, number>;
}

/**
 * Service for handling raw transaction persistence and MRR aggregation.
 */
export class RevenueService {
  /**
   * Upserts newly fetched normalized transactions to the database.
   * Returns the number of successfully synced transactions.
   */
  async upsertTransactions(request: UpsertTransactionsRequest): Promise<UpsertTransactionsResult> {
    let successful = 0;
    let failed = 0;
    const errors: any[] = [];
    
    for (const tx of request.transactions) {
      const { error } = await supabaseServer.from("revenue_transactions").upsert(
        {
          startup_id: request.startupId,
          provider: request.provider,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          external_id: tx.external_payment_id,
          payment_id: tx.external_payment_id,
          created_at: new Date(tx.timestamp).toISOString(),
        },
        { onConflict: "external_id" }
      );
      if (error) {
        if (!error.message?.toLowerCase().includes("duplicate")) {
          failed++;
          errors.push(error);
        } else {
          successful++;
        }
      } else {
        successful++;
      }
    }
    return { successful, failed, errors };
  }

  /**
   * Calculates the current total MRR across all providers.
   */
  async aggregateRevenue(
    startupId: number | string,
    prefetchedProviders?: Record<string, ProviderRevenue>,
    skipPersist: boolean = false
  ): Promise<AggregateRevenueResult> {
    const aggregated = await getAggregatedRevenue(Number(startupId), prefetchedProviders, skipPersist);
    return {
      totalRevenue: aggregated?.totalRevenue ?? 0,
      breakdown: aggregated?.breakdown || {},
    };
  }
}

export const revenueService = new RevenueService();
