import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase-server";
import { encrypt, decrypt } from "@/lib/encryption";
import { VerificationPipeline } from "@/lib/providers/pipeline";
import { razorpayProvider } from "@/lib/providers/razorpay";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export type RazorpayCapturedPayment = {
  id: string;
  amount: number;
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
      if (p.status !== "captured") continue;
      collected.push({
        id: p.id,
        amount: Number(p.amount) || 0,
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



/**
 * Runs the full Razorpay verification through the Provider Engine pipeline.
 *
 * The pipeline handles: fraud detection → transaction upsert → revenue aggregation
 * → snapshot → trust score → connection update → startup status → event log.
 */
export async function completeRazorpayVerification(
  startupId: number,
  razorpay: Razorpay,
  credentials?: { keyId: string; keySecret: string }
): Promise<RazorpayVerificationResult> {
  // Build the pipeline context.
  // For the resync case, we pass serializedCredentials with the decrypted key
  // so the provider can use it to fetch transactions.
  // For the fresh verification case, we pass rawCredentials.
  const pipeline = new VerificationPipeline({
    startupId,
    provider: razorpayProvider,
    ...(credentials
      ? {
          rawCredentials: {
            keyId: credentials.keyId,
            keySecret: credentials.keySecret,
          },
        }
      : {
          // Resync path: we already have a validated Razorpay client.
          // Extract the credentials from the client config for the pipeline.
          serializedCredentials: {
            accountId: (razorpay as any)._conf?.key_id ?? "",
            encryptedKey: (razorpay as any)._conf?.key_secret ?? "",
          },
        }),
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
  const razorpay = createRazorpayClient(params.keyId, params.keySecret);

  return completeRazorpayVerification(params.startupId, razorpay, {
    keyId: params.keyId,
    keySecret: params.keySecret,
  });
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

  const keySecret = decrypt(conn.api_key_encrypted);
  const razorpay = createRazorpayClient(conn.account_id, keySecret);
  return completeRazorpayVerification(startupId, razorpay, {
    keyId: conn.account_id,
    keySecret,
  });
}

export function resolveStartupIdFromRazorpayPaymentNotes(
  notes?: Record<string, string | undefined>
): number | null {
  const raw = notes?.startup_id;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

