import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyStartupOwnership } from "@/lib/auth-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Commercial Model: Investor Report is a ₹499 one-time add-on.
 * Fixed Invariants:
 * - Amount is strictly server-defined as 49900 paise (₹499 INR).
 * - Currency is strictly INR.
 * - Uses Razorpay Orders API (NOT subscriptions).
 * - Requires authenticated user + validated startup ownership.
 * - Primary Concurrency Guarantee: PostgreSQL Partial Unique Index `idx_investor_reports_pending_unique`
 *   on (user_id, startup_id) WHERE payment_status = 'pending'.
 * - Provider-Verified Reconciliation: Never infers payment failure solely from elapsed time.
 * - Secondary Optimization: In-flight promise map for same-process deduplication.
 */
const REPORT_AMOUNT_PAISE = 49900;
const REPORT_AMOUNT_INR = 499;
const REPORT_CURRENCY = "INR";
const REPORT_PERIOD = "30_days";

interface CreateReportOrderBody {
  startup_id?: unknown;
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Same-process in-flight promise map (optimization only; database index is the primary guarantee).
 */
const inFlightOrderCreations = new Map<string, Promise<NextResponse>>();

/**
 * Generates a collision-resistant Razorpay receipt string (max 40 chars).
 * Format: rep_<startupId>_<timestamp36>_<randomHex>
 */
export function generateReportReceipt(startupId: number): string {
  const timePart = Date.now().toString(36);
  const entropy = crypto.randomBytes(4).toString("hex"); // 8 hex chars (4.29 billion combinations)
  const full = `rep_${startupId}_${timePart}_${entropy}`;
  return full.substring(0, 40);
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (Anti-spam / Anti-bruteforce)
    const identifier = getClientIdentifier(req);
    const { allowed } = await checkRateLimit(identifier, 60000, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 2. Authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 3. Request Payload Validation
    let body: CreateReportOrderBody;
    try {
      body = (await req.json()) as CreateReportOrderBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { startup_id } = body;

    if (
      startup_id === undefined ||
      startup_id === null ||
      typeof startup_id !== "number" ||
      !Number.isInteger(startup_id) ||
      !Number.isFinite(startup_id) ||
      startup_id <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid or missing startup_id. Must be a positive integer." },
        { status: 400 }
      );
    }

    // 4. Startup Existence & Ownership Verification (Strict IDOR defense)
    const ownership = await verifyStartupOwnership(startup_id);
    if (!ownership.authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!ownership.owned || !ownership.startup) {
      return NextResponse.json(
        { error: "Startup not found or not owned by authenticated user" },
        { status: 403 }
      );
    }

    if (ownership.isDemo) {
      return NextResponse.json(
        { error: "Demo and sandbox startups cannot purchase investor reports" },
        { status: 403 }
      );
    }

    // 5. In-flight Request Deduplication (Same-Process Optimization)
    const flightKey = `${user.id}:${startup_id}`;
    if (inFlightOrderCreations.has(flightKey)) {
      return await inFlightOrderCreations.get(flightKey)!;
    }

    const creationPromise = (async () => {
      // 6. Razorpay Server Configuration Validation
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        console.error("[Investor Report] Missing Razorpay server credentials");
        return NextResponse.json(
          { error: "Razorpay billing credentials are not configured" },
          { status: 500 }
        );
      }

      // 7. Provider-Verified Pending Order Reconciliation
      // Query for any existing pending order for this (user_id, startup_id)
      const { data: existingPending } = await supabaseServer
        .from("investor_reports")
        .select("id, razorpay_order_id, created_at, payment_status")
        .eq("user_id", user.id)
        .eq("startup_id", startup_id)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPending && existingPending.razorpay_order_id) {
        const createdAtMs = new Date(existingPending.created_at).getTime();
        const ageMs = Date.now() - createdAtMs;
        const isRecent = ageMs < 15 * 60 * 1000; // Under 15 minutes

        if (isRecent) {
          // Recent active pending order: reuse immediately
          return NextResponse.json({
            success: true,
            report_id: existingPending.id,
            order_id: existingPending.razorpay_order_id,
            amount: REPORT_AMOUNT_PAISE,
            currency: REPORT_CURRENCY,
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
          });
        }

        // Pending order is older than 15 minutes.
        // PRINCIPLE: NEVER infer payment failure solely from elapsed time.
        // Reconcile status directly with Razorpay provider API.
        try {
          const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
          const rzpOrder = await razorpay.orders.fetch(existingPending.razorpay_order_id);

          if (rzpOrder.status === "paid") {
            // Payment succeeded at provider (e.g. webhook was delayed)
            // Preserve record; never mark failed.
            console.log(`[Investor Report] Order ${existingPending.razorpay_order_id} is paid at provider. Preserving record.`);
            return NextResponse.json({
              success: true,
              report_id: existingPending.id,
              order_id: existingPending.razorpay_order_id,
              amount: REPORT_AMOUNT_PAISE,
              currency: REPORT_CURRENCY,
              key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
              already_paid: true,
            });
          }

          // Check if any captured payment exists on this order
          const payments = await razorpay.orders.fetchPayments(existingPending.razorpay_order_id);
          const hasSuccessfulPayment = payments.items?.some(
            (p: { status?: string }) => p.status === "captured" || p.status === "authorized"
          );

          if (hasSuccessfulPayment) {
            console.log(`[Investor Report] Captured payment detected on order ${existingPending.razorpay_order_id}. Preserving record.`);
            return NextResponse.json({
              success: true,
              report_id: existingPending.id,
              order_id: existingPending.razorpay_order_id,
              amount: REPORT_AMOUNT_PAISE,
              currency: REPORT_CURRENCY,
              key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
              already_paid: true,
            });
          }

          // Only when provider explicitly confirms 0 successful payments and order is uncaptured:
          // Safely transition stale record to failed to release the database unique index.
          console.log(`[Investor Report] Provider confirmed 0 payments for stale order ${existingPending.razorpay_order_id}. Transitioning to failed.`);
          await supabaseServer
            .from("investor_reports")
            .update({ payment_status: "failed" })
            .eq("id", existingPending.id)
            .eq("payment_status", "pending");
        } catch (reconcileErr: unknown) {
          // Fail-Safe: If provider cannot be reached, do NOT falsely mark failed.
          // Retain existing pending order and return it to the client.
          console.warn("[Investor Report] Provider reconciliation error. Retaining pending order:", reconcileErr);
          return NextResponse.json({
            success: true,
            report_id: existingPending.id,
            order_id: existingPending.razorpay_order_id,
            amount: REPORT_AMOUNT_PAISE,
            currency: REPORT_CURRENCY,
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
          });
        }
      }

      // 8. Create Razorpay Order (One-Time Payment with Collision-Resistant Receipt)
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const receipt = generateReportReceipt(startup_id);
      let order: RazorpayOrderResponse;

      try {
        const createdOrder = await razorpay.orders.create({
          amount: REPORT_AMOUNT_PAISE,
          currency: REPORT_CURRENCY,
          receipt,
          notes: {
            startup_id: String(startup_id),
            user_id: user.id,
            report_period: REPORT_PERIOD,
            purpose: "investor_report",
          },
        });
        order = createdOrder as unknown as RazorpayOrderResponse;
      } catch (rzpErr: unknown) {
        const errMsg = rzpErr instanceof Error ? rzpErr.message : String(rzpErr);
        console.error("[Investor Report] Failed to create Razorpay order:", errMsg);
        return NextResponse.json(
          { error: "Failed to initialize payment order with payment gateway" },
          { status: 502 }
        );
      }

      if (!order || !order.id) {
        console.error("[Investor Report] Razorpay returned invalid order response:", order);
        return NextResponse.json(
          { error: "Payment gateway returned invalid order response" },
          { status: 502 }
        );
      }

      // 9. Insert Pending Record Protected by Database-Level Partial Unique Index
      const { data: newReport, error: insertError } = await supabaseServer
        .from("investor_reports")
        .insert({
          user_id: user.id,
          startup_id: startup_id,
          amount_inr: REPORT_AMOUNT_INR,
          currency: REPORT_CURRENCY,
          razorpay_order_id: order.id,
          payment_status: "pending",
          generation_status: "pending",
          report_period: REPORT_PERIOD,
          metrics_snapshot: {},
          storage_path: null,
        })
        .select("id")
        .single();

      if (insertError) {
        // Handle PostgreSQL Unique Constraint Violation (Code 23505) across serverless instances
        if (insertError.code === "23505" || insertError.message?.includes("idx_investor_reports_pending_unique")) {
          // Architectural Note: Razorpay Orders API does not support order cancellation.
          // The losing order object will expire unpaid with zero financial charges.
          console.info(`[Investor Report INFO] Concurrent instance lost DB 23505 race. Unpaid Razorpay order ${order.id} will expire naturally.`);
          
          const { data: winningReport } = await supabaseServer
            .from("investor_reports")
            .select("id, razorpay_order_id")
            .eq("user_id", user.id)
            .eq("startup_id", startup_id)
            .eq("payment_status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (winningReport && winningReport.razorpay_order_id) {
            return NextResponse.json({
              success: true,
              report_id: winningReport.id,
              order_id: winningReport.razorpay_order_id,
              amount: REPORT_AMOUNT_PAISE,
              currency: REPORT_CURRENCY,
              key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
            });
          }
        }

        console.error("[Investor Report CRITICAL] Database insert failed for Razorpay order:", {
          orderId: order.id,
          userId: user.id,
          startupId: startup_id,
          error: insertError,
        });
        return NextResponse.json(
          { error: "Failed to record report initialization in database" },
          { status: 500 }
        );
      }

      if (!newReport) {
        return NextResponse.json(
          { error: "Failed to initialize investor report record" },
          { status: 500 }
        );
      }

      // 10. Return Safe Client Response (Zero secrets exposed)
      return NextResponse.json({
        success: true,
        report_id: newReport.id,
        order_id: order.id,
        amount: REPORT_AMOUNT_PAISE,
        currency: REPORT_CURRENCY,
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
      });
    })();

    inFlightOrderCreations.set(flightKey, creationPromise);

    try {
      return await creationPromise;
    } finally {
      inFlightOrderCreations.delete(flightKey);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Investor Report] Unhandled exception in create-order route:", errMsg);
    return NextResponse.json(
      { error: "Internal server error processing report order" },
      { status: 500 }
    );
  }
}
