import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import { VerificationPipeline } from "@/lib/providers/pipeline";
import { razorpayProvider } from "@/lib/providers/razorpay";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export type RazorpayCapturedPayment = {
  id: string;
  amount: number; // Net amount in paise
  gross_amount?: number;
  refund_amount?: number;
  currency: string;
  status: string;
  created_at: number;
};

export type RazorpayVerificationResult = {
  revenue: number;
  breakdown: Record<string, number>;
  currency: string;
  total_transactions: number;
};

export function createRazorpayClient(keyId: string, keySecret: string): Razorpay {
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function fetchRazorpayCapturedPayments(
  razorpay: Razorpay
): Promise<RazorpayCapturedPayment[]> {
  const from = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
  const to = Math.floor(Date.now() / 1000);
  const collected: RazorpayCapturedPayment[] = [];
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
      const grossPaise = Number(p.amount) || 0;
      const refundPaise = Number(p.amount_refunded) || 0;
      const netPaise = Math.max(0, grossPaise - refundPaise);

      collected.push({
        id: p.id,
        amount: netPaise,
        gross_amount: grossPaise,
        refund_amount: refundPaise,
        currency: p.currency || "INR",
        status: p.status,
        created_at: Number(p.created_at) || 0,
      });
    }

    if (items.length < pageSize) break;
    skip += pageSize;
  }

  return collected;
}



import { RuntimeCredentials, SerializedCredentials } from "@/lib/providers/provider";

/**
 * Runs the full Razorpay verification through the Provider Engine pipeline.
 *
 * The pipeline handles: credential verification → transaction retrieval → fraud detection
 * → transaction upsert → revenue aggregation → snapshot → connection update
 * → trust score → startup status (api_verified) → event log.
 */
export async function completeRazorpayVerification(
  startupId: number,
  runtimeCredentials: RuntimeCredentials,
  serializedCredentials?: SerializedCredentials
): Promise<RazorpayVerificationResult> {
  const pipeline = new VerificationPipeline({
    startupId,
    provider: razorpayProvider,
    runtimeCredentials,
    serializedCredentials,
  });

  const result = await pipeline.execute();

  if (!result.success) {
    throw result.error ?? new Error("Razorpay verification pipeline failed");
  }

  return {
    revenue: result.revenue ?? 0,
    breakdown: result.breakdown ?? {},
    currency: result.currency ?? "INR",
    total_transactions: result.totalTransactions ?? 0,
  };
}

export async function verifyRazorpayApiKeys(params: {
  keyId: string;
  keySecret: string;
  startupId: number;
}): Promise<RazorpayVerificationResult> {
  const runtimeCredentials: RuntimeCredentials = {
    accountId: params.keyId,
    secretKey: params.keySecret,
  };

  return completeRazorpayVerification(params.startupId, runtimeCredentials);
}

export async function resyncExistingRazorpayConnection(
  startupId: number
): Promise<RazorpayVerificationResult> {
  const { data: conn, error } = await supabaseServer
    .from("provider_connections")
    .select("*")
    .eq("startup_id", startupId)
    .eq("provider", "razorpay")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !conn?.account_id || !conn.api_key_encrypted) {
    throw new Error("No active Razorpay connection found for this startup");
  }

  // 1. Read encrypted credential from database
  // 2. Decrypt it in memory only
  const keySecret = decrypt(conn.api_key_encrypted);

  const runtimeCredentials: RuntimeCredentials = {
    accountId: conn.account_id,
    secretKey: keySecret,
  };

  const serializedCredentials: SerializedCredentials = {
    accountId: conn.account_id,
    encryptedKey: conn.api_key_encrypted,
  };

  return completeRazorpayVerification(
    startupId,
    runtimeCredentials,
    serializedCredentials
  );
}

export function resolveStartupIdFromRazorpayPaymentNotes(
  notes?: Record<string, string | undefined>
): number | null {
  const raw = notes?.startup_id;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

