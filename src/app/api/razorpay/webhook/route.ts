import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { updateRevenueAndSnapshot } from "@/lib/webhook-handler";
import crypto from "crypto";

/**
 * Razorpay Webhook Handler (/api/razorpay/webhook)
 *
 * Receives real-time payment events from Razorpay.
 * Handles `payment.captured` to update revenue + snapshots + trust score.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 50);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  console.log("🔒 [Razorpay Webhook] Verifying signature...");

  if (!signature) {
    console.error("❌ Missing x-razorpay-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("❌ RAZORPAY_WEBHOOK_SECRET is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("❌ Invalid Razorpay signature mismatch");
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("✅ Signature verified");

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("❌ Failed to parse webhook JSON");
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event;
  if (event === "payment.refunded") {
    const payment = payload.payload.payment.entity;
    const startupId = Number(payment.notes?.startup_id);
    const amount = payment.amount / 100;
    const paymentId = payment.id;

    if (!startupId) {
      console.warn("[Razorpay Webhook] Refund missing startup_id:", paymentId);
      return new Response("No startup_id", { status: 200 });
    }

    // 1. Prevent double refunds
    const { data: existingRefund } = await supabaseServer
      .from("revenue_transactions")
      .select("id")
      .eq("payment_id", paymentId + "_refund")
      .maybeSingle();

    if (existingRefund) {
      console.log("🟡 Duplicate refund ignored:", paymentId);
      return new Response("Duplicate refund", { status: 200 });
    }

    // 2. Insert refund transaction
    await supabaseServer.from("revenue_transactions").insert({
      startup_id: startupId,
      payment_id: paymentId + "_refund",
      amount: -amount,
      provider: "razorpay"
    });

    // 3. Fetch current breakdown
    const { data: startup } = await supabaseServer
      .from("startup_submissions")
      .select("mrr_breakdown")
      .eq("id", startupId)
      .single();

    let mrr_breakdown = (startup?.mrr_breakdown as any) || {};

    // 4. Update breakdown
    mrr_breakdown["razorpay"] = (mrr_breakdown["razorpay"] || 0) - amount;
    if (mrr_breakdown["razorpay"] < 0) {
      mrr_breakdown["razorpay"] = 0;
    }

    // 5. Recalculate total
    const totalMrr = Object.values(mrr_breakdown).reduce((a: number, b: any) => a + Number(b), 0);

    // 6. Update DB
    await supabaseServer.from("startup_submissions").update({
      mrr: totalMrr,
      mrr_breakdown
    }).eq("id", startupId);

    // 7. Insert snapshot (dedupe logic)
    const { data: lastSnapshot } = await supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSnapshot || lastSnapshot.total_revenue !== totalMrr) {
      await supabaseServer.from("revenue_snapshots").insert({
        startup_id: startupId,
        total_revenue: totalMrr,
        provider_breakdown: mrr_breakdown
      });
    }

    console.log("Refund processed:", paymentId, amount);
    return new Response("Refund processed", { status: 200 });
  }

  if (event !== "payment.captured") {
    console.log("Ignoring event:", event);
    return new Response("Ignored", { status: 200 });
  }

  try {
    const payment = payload.payload?.payment?.entity;

    if (!payment) {
      console.warn("[Razorpay Webhook] No payment entity in payload");
      return NextResponse.json({ received: true, skipped: "no_payment_entity" });
    }

    const amount = (payment.amount || 0) / 100; // paise → rupees

    if (amount < 100) {
      console.log("Ignoring micro-payment completely:", amount);
      return new Response("Ignored micro payment", { status: 200 });
    }

    // Try notes first, then fall back to provider_connections lookup
    let startupId = payment.notes?.startup_id
      ? Number(payment.notes.startup_id)
      : null;

    if (!startupId) {
      // Fall back: find the most recently connected Razorpay account
      const { data: connection } = await supabaseServer
        .from("provider_connections")
        .select("startup_id")
        .eq("provider", "razorpay")
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (connection) {
        startupId = connection.startup_id;
        console.log("[Razorpay Webhook] Mapped to startup via fallback:", startupId);
      }
    }

    if (!startupId) {
      console.warn("[Razorpay Webhook] No startup_id found for payment:", payment.id);
      return NextResponse.json({ received: true, skipped: "no_startup_id" });
    }

    const createdAt = payment.created_at
      ? new Date(payment.created_at * 1000).toISOString()
      : new Date().toISOString();

    if (!payment.created_at) {
      console.warn("Missing created_at in webhook, using current time");
    }

    // Record raw transaction
    await supabaseServer.from("revenue_transactions").upsert({
      startup_id: startupId,
      provider: "razorpay",
      amount: payment.amount, // stored in paise
      currency: (payment.currency || "INR").toUpperCase(),
      status: payment.status,
      external_id: payment.id,
      created_at: createdAt,
    }, { onConflict: "external_id" });

    // 🔥 Real-time revenue + snapshot + trust update
    await updateRevenueAndSnapshot(startupId, amount, "razorpay", payment.id);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Razorpay Webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
