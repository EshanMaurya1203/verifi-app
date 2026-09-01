import Razorpay from "razorpay";
import { encrypt } from "@/lib/encryption";
import {
  Provider,
  RuntimeCredentials,
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
 *   - Credential verification against Razorpay API using in-memory RuntimeCredentials
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
  // Defensive Guards (Defense-in-Depth)
  // ---------------------------------------------------------------------------

  /**
   * Defense-in-depth check: verifies that a secret key is not accidental ciphertext.
   * NOTE: This format check is strictly defense-in-depth; the primary boundary
   * is the separation of RuntimeCredentials and SerializedCredentials in the type system.
   */
  private isCiphertext(value: string): boolean {
    if (!value || typeof value !== "string") return false;
    const parts = value.split(":");
    return (
      (parts.length === 3 && parts.every((p) => /^[0-9a-fA-F]+$/.test(p))) ||
      (parts.length === 2 && parts.every((p) => /^[0-9a-fA-F]+$/.test(p)))
    );
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Core Methods
  // ---------------------------------------------------------------------------

  async verifyCredentials(credentials: RuntimeCredentials): Promise<boolean> {
    const { accountId, secretKey } = credentials;
    if (!accountId || !secretKey) return false;

    if (this.isCiphertext(secretKey)) {
      throw new Error(
        "Cannot verify credentials using ciphertext. Runtime plaintext secret is required."
      );
    }

    const razorpay = new Razorpay({ key_id: accountId, key_secret: secretKey });
    try {
      await razorpay.payments.all({ count: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async fetchTransactions(
    credentials: RuntimeCredentials,
    options?: any
  ): Promise<NormalizedPayment[]> {
    const { accountId, secretKey } = credentials;
    if (!accountId || !secretKey) {
      throw new Error("Missing runtime credentials for fetching Razorpay transactions");
    }

    if (this.isCiphertext(secretKey)) {
      throw new Error(
        "Cannot fetch transactions with ciphertext. Runtime plaintext secret is required."
      );
    }

    const razorpay = new Razorpay({ key_id: accountId, key_secret: secretKey });
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
        if (p.status !== "captured" && p.status !== "refunded") continue;
        const grossAmount = (Number(p.amount) || 0) / 100;
        const refundAmount = (Number(p.amount_refunded) || 0) / 100;
        const netAmount = Math.max(0, grossAmount - refundAmount);

        collected.push({
          external_payment_id: p.id,
          amount: netAmount,
          gross_amount: grossAmount,
          refund_amount: refundAmount,
          net_amount: netAmount,
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
    credentials: RuntimeCredentials
  ): Promise<ProviderRevenueResult> {
    const transactions = await this.fetchTransactions(credentials);
    const revenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currency = transactions[0]?.currency || "INR";
    return { revenue, currency, transactionCount: transactions.length };
  }

  async serializeCredentials(
    credentials: RuntimeCredentials
  ): Promise<SerializedCredentials> {
    const { accountId, secretKey } = credentials;
    if (!accountId || !secretKey) {
      throw new Error("Cannot serialize incomplete runtime credentials");
    }
    return {
      accountId,
      encryptedKey: encrypt(secretKey),
    };
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Lifecycle Methods
  // ---------------------------------------------------------------------------

  async connect(_startupId: string, _credentials: RuntimeCredentials): Promise<void> {
    // Connection persistence is handled by the pipeline
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
