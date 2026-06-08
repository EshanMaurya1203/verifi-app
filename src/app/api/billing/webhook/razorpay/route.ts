import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

const RAZORPAY_PLAN_MAP: Record<string, Record<string, string | undefined>> = {
  founder: {
    monthly: process.env.RAZORPAY_PLAN_FOUNDER_MONTHLY,
    annual: process.env.RAZORPAY_PLAN_FOUNDER_ANNUAL,
  },
  pro: {
    monthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY,
    annual: process.env.RAZORPAY_PLAN_PRO_ANNUAL,
  },
};

type PlanCode = "founder" | "pro";
type BillingCycle = "monthly" | "annual";

function resolvePlanFromRazorpayPlanId(planId: string | undefined): {
  plan_code: PlanCode;
  billing_cycle: BillingCycle;
} | null {
  if (!planId) return null;

  for (const [planCode, cycles] of Object.entries(RAZORPAY_PLAN_MAP)) {
    for (const [billingCycle, razorpayPlanId] of Object.entries(cycles)) {
      if (razorpayPlanId && razorpayPlanId === planId) {
        return {
          plan_code: planCode as PlanCode,
          billing_cycle: billingCycle as BillingCycle,
        };
      }
    }
  }

  return null;
}

function secondsToIso(seconds: number | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Dedicated Billing Webhook Handler (/api/billing/webhook/razorpay)
 *
 * Exclusively handles SaaS billing events for Verifii subscriptions.
 * Verification webhooks are strictly isolated in /api/razorpay/webhook.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  if (!process.env.RAZORPAY_BILLING_WEBHOOK_SECRET) {
    console.error("❌ RAZORPAY_BILLING_WEBHOOK_SECRET is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_BILLING_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("❌ Invalid Razorpay billing signature mismatch");
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event;
  const subscription = payload.payload?.subscription?.entity;

  if (!subscription || !subscription.id) {
    return NextResponse.json({ received: true, skipped: "no_subscription_entity" });
  }

  const userId = subscription.notes?.user_id;
  if (!userId) {
    console.warn("[Billing Webhook] Missing notes.user_id for subscription:", subscription.id);
    return NextResponse.json({ received: true, skipped: "no_user_id" });
  }

  const resolvedPlan = resolvePlanFromRazorpayPlanId(subscription.plan_id);
  if (!resolvedPlan) {
    console.error("[Billing Webhook] Unknown Razorpay plan_id:", subscription.plan_id);
    return NextResponse.json({ received: true, skipped: "unknown_plan_id" });
  }

  // Parse timestamps (Razorpay sends unix timestamps in seconds)
  const currentPeriodStart = secondsToIso(subscription.current_start) || new Date().toISOString();
  const currentPeriodEnd = secondsToIso(subscription.current_end) || new Date().toISOString();
  const trialStart = secondsToIso(subscription.start_at);
  let trialEnd = secondsToIso(subscription.charge_at);
  const eventAt =
    secondsToIso(payload.created_at) ||
    secondsToIso(subscription.updated_at) ||
    new Date().toISOString();
  const eventId =
    payload.id ||
    payload.event_id ||
    `${event}:${subscription.id}:${eventAt}:${subscription.status || ""}:${subscription.plan_id || ""}`;

  const { data: existingSub, error: existingSubError } = await supabaseServer
    .from("subscriptions")
    .select("id, last_billing_event_at, last_billing_event_id")
    .eq("razorpay_subscription_id", subscription.id)
    .maybeSingle();

  if (existingSubError) {
    console.error("[Billing Webhook] Failed to read existing subscription:", existingSubError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (existingSub?.last_billing_event_id && existingSub.last_billing_event_id === eventId) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (
    existingSub?.last_billing_event_at &&
    new Date(eventAt).getTime() < new Date(existingSub.last_billing_event_at).getTime()
  ) {
    return NextResponse.json({ received: true, skipped: "stale_event" });
  }

  // Determine local status mapping
  let localStatus = "active";

  switch (event) {
    case "subscription.authenticated":
    case "subscription.activated":
      if (subscription.status === "active") {
        localStatus = "active";
      } else if (subscription.status === "created" || subscription.status === "authenticated") {
        localStatus = "trialing";
      }
      break;
    case "subscription.charged":
      localStatus = "active";
      break;
    case "subscription.halted":
      localStatus = "past_due";
      break;
    case "subscription.cancelled":
      localStatus = "cancelled";
      break;
    case "subscription.completed":
      localStatus = "expired";
      break;
    case "subscription.updated":
      // Fallback mapping based on Razorpay's entity status
      if (subscription.status === "active") localStatus = "active";
      else if (subscription.status === "halted") localStatus = "past_due";
      else if (subscription.status === "cancelled") localStatus = "cancelled";
      else if (subscription.status === "completed") localStatus = "expired";
      break;
    default:
      console.log(`[Billing Webhook] Unhandled event type: ${event}`);
      return NextResponse.json({ received: true, skipped: "unhandled_event" });
  }

  // Handle trials specifically if present in Razorpay payload
  // Typically, if Razorpay says it's not started or charge at is in the future
  if (subscription.charge_at && subscription.charge_at > (Date.now() / 1000) && localStatus !== 'cancelled') {
    localStatus = "trialing";
    trialEnd = secondsToIso(subscription.charge_at);
  }

  // Write to subscriptions table (Source of Truth)
  const { data: upsertedSub, error: upsertError } = await supabaseServer
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_code: resolvedPlan.plan_code,
        billing_cycle: resolvedPlan.billing_cycle,
        status: localStatus,
        razorpay_subscription_id: subscription.id,
        razorpay_customer_id: subscription.customer_id,
        razorpay_plan_id: subscription.plan_id,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        last_billing_event_at: eventAt,
        last_billing_event_id: eventId,
        ...(trialStart ? { trial_start: trialStart } : {}),
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
      { onConflict: "razorpay_subscription_id" }
    )
    .select("id")
    .single();

  if (upsertError) {
    console.error("[Billing Webhook] Failed to upsert subscription:", upsertError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Write audit event
  await supabaseServer.from("subscription_events").insert({
    subscription_id: upsertedSub?.id,
    user_id: userId,
    event_type: event,
    new_status: localStatus,
    new_plan_code: resolvedPlan.plan_code,
    metadata: {
      payload,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: subscription.plan_id,
      billing_cycle: resolvedPlan.billing_cycle,
    },
    created_at: new Date().toISOString()
  });

  return NextResponse.json({ received: true, status: localStatus });
}
