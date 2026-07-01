import Razorpay from "razorpay";
import { encrypt } from "@/lib/encryption";
import {
  Provider,
  ProviderCredentials,
  SerializedCredentials,
  ProviderRevenueResult,
  WebhookResult,
} from "./provider";
import { NormalizedPayment } from "./types";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

/**
 * RazorpayProvider — Reference implementation of the Provider interface.
 *
 * Responsible ONLY for:
 *   - Credential verification against Razorpay API
 *   - Fetching raw payment data from Razorpay
 *   - Normalizing Razorpay responses into NormalizedPayment[]
 *   - Serializing credentials for encrypted storage
 *
 * All orchestration (fraud, snapshots, trust, persistence) is handled
 * by the VerificationPipeline and shared services.
 */
export class RazorpayProvider implements Provider {
  readonly id = "razorpay";
  readonly name = "Razorpay";

  // ---------------------------------------------------------------------------
  // Provider Interface — Core Methods
  // ---------------------------------------------------------------------------

  async verifyCredentials(credentials: ProviderCredentials): Promise<boolean> {
    const { keyId, keySecret } = credentials;
    if (!keyId || !keySecret) return false;

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    try {
      await razorpay.payments.all({ count: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async fetchTransactions(
    accountId: string,
    decryptedKey: string
  ): Promise<NormalizedPayment[]> {
    const razorpay = new Razorpay({ key_id: accountId, key_secret: decryptedKey });
    const from = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
    const to = Math.floor(Date.now() / 1000);
    const collected: NormalizedPayment[] = [];
    let skip = 0;
    const pageSize = 100;

    while (true) {
      const response = await razorpay.payments.all({
        from,
        to,
        count: pageSize,
        skip,
      });

      const items = response?.items || [];
      if (items.length === 0) break;

      for (const p of items) {
        if (p.status !== "captured") continue;
        collected.push({
          external_payment_id: p.id,
          amount: (Number(p.amount) || 0) / 100,
          currency: ((p.currency as string) || "INR").toUpperCase(),
          timestamp: (Number(p.created_at) || 0) * 1000,
          status: p.status,
          provider: "razorpay",
        });
      }

      if (items.length < pageSize) break;
      skip += pageSize;
    }

    return collected;
  }

  async fetchRevenue(
    accountId: string,
    decryptedKey: string
  ): Promise<ProviderRevenueResult> {
    const transactions = await this.fetchTransactions(accountId, decryptedKey);
    const revenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currency = transactions[0]?.currency || "INR";
    return { revenue, currency, transactionCount: transactions.length };
  }

  async serializeCredentials(
    credentials: ProviderCredentials
  ): Promise<SerializedCredentials> {
    const { keyId, keySecret } = credentials;
    return {
      accountId: keyId,
      encryptedKey: encrypt(keySecret),
    };
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Lifecycle Methods
  // ---------------------------------------------------------------------------

  async connect(_startupId: string, _credentials: ProviderCredentials): Promise<void> {
    // Connection persistence is handled by the pipeline's Stage 8
  }

  async disconnect(_startupId: string): Promise<void> {
    // Disconnection is handled externally via API routes
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Webhook & Health
  // ---------------------------------------------------------------------------

  async parseWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    if (!paymentEntity) {
      throw new Error("Invalid Razorpay webhook payload");
    }

    return {
      paymentId: paymentEntity.id,
      amount: (Number(paymentEntity.amount) || 0) / 100,
      currency: ((paymentEntity.currency as string) || "INR").toUpperCase(),
      status: event === "payment.captured" ? "captured" : paymentEntity.status,
      provider: "razorpay",
    };
  }

  async healthCheck(): Promise<boolean> {
    // Razorpay does not expose a dedicated health endpoint.
    return true;
  }
}

export const razorpayProvider = new RazorpayProvider();
