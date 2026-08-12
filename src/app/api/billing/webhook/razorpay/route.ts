import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import { dispatchNotification } from "@/notifications/dispatcher";

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

async function handleBillingNotification({
  userId,
  event,
  eventId,
  subscription,
  planCode,
  billingCycle,
  currentPeriodEnd,
}: {
  userId: string;
  event: string;
  eventId: string;
  subscription: any;
  planCode: string;
  billingCycle: string;
  currentPeriodEnd?: string | null;
}) {
  try {
    const { data: userData } = await supabaseServer.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    if (!userEmail) {
      console.warn(`[Billing Webhook Notification] No email found for user ${userId}`);
      return;
    }

    const founderName =
      userData?.user?.user_metadata?.full_name ||
      userData?.user?.user_metadata?.name ||
      userEmail.split("@")[0];

    const { data: startup } = await supabaseServer
      .from("startup_submissions")
      .select("startup_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startupName = startup?.startup_name || "Your Startup";
    const formattedPlan = `${planCode.toUpperCase()} (${billingCycle})`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.verifii.in";
    const idempotencyKey = `ntf_billing_${event}_${subscription.id}_${eventId}`;

    const paidCount = subscription.paid_count ?? 0;
    const isInitialActivation = event === "subscription.activated" || (event === "subscription.charged" && paidCount <= 1);
    const isRecurringRenewal = event === "subscription.charged" && paidCount > 1;

    if (isInitialActivation) {
      await dispatchNotification({
        type: "SUBSCRIPTION_ACTIVATED",
        metadata: {
          eventId: crypto.randomUUID(),
          occurredAt: new Date(),
          source: "WEBHOOK",
          version: 1,
          idempotencyKey,
        },
        idempotencyKey,
        payload: {
          email: userEmail,
          founderName,
          startupName,
          planName: formattedPlan,
          amountPaid: "Activated",
          nextBillingDate: currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
          dashboardUrl: `${baseUrl}/dashboard`,
        },
      });
    } else if (isRecurringRenewal) {
      await dispatchNotification({
        type: "SUBSCRIPTION_RENEWED",
        metadata: {
          eventId: crypto.randomUUID(),
          occurredAt: new Date(),
          source: "WEBHOOK",
          version: 1,
          idempotencyKey,
        },
        idempotencyKey,
        payload: {
          email: userEmail,
          founderName,
          startupName,
          planName: formattedPlan,
          amountPaid: "Successful",
          nextBillingDate: currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
          dashboardUrl: `${baseUrl}/dashboard`,
        },
      });
    } else if (event === "subscription.halted") {
      await dispatchNotification({
        type: "PAYMENT_FAILED",
        metadata: {
          eventId: crypto.randomUUID(),
          occurredAt: new Date(),
          source: "WEBHOOK",
          version: 1,
          idempotencyKey,
        },
        idempotencyKey,
        payload: {
          email: userEmail,
          founderName,
          startupName,
          planName: formattedPlan,
          amountDue: "Subscription Renewal Fee",
          failureReason: "Recurring charge failed or was declined.",
          updatePaymentUrl: `${baseUrl}/dashboard/settings/billing`,
        },
      });
    } else if (event === "subscription.cancelled") {
      await dispatchNotification({
        type: "SUBSCRIPTION_CANCELLED",
        metadata: {
          eventId: crypto.randomUUID(),
          occurredAt: new Date(),
          source: "WEBHOOK",
          version: 1,
          idempotencyKey,
        },
        idempotencyKey,
        payload: {
          email: userEmail,
          founderName,
          startupName,
          planName: formattedPlan,
          effectiveEndDate: currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
          reactivateUrl: `${baseUrl}/dashboard/settings/billing`,
        },
      });
    }
  } catch (err) {
    console.error("[Billing Webhook Notification] Failed to dispatch notification:", err);
  }
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

  const replacesSubId = subscription.notes?.replaces_subscription_id;

  const resolvedPlan = resolvePlanFromRazorpayPlanId(subscription.plan_id);
  if (!resolvedPlan) {
    console.error("[Billing Webhook] Unknown Razorpay plan_id:", subscription.plan_id);
    return NextResponse.json({ received: true, skipped: "unknown_plan_id" });
  }

  // Parse timestamps (Razorpay sends unix timestamps in seconds)
  const eventAt =
    secondsToIso(payload.created_at) ||
    secondsToIso(subscription.updated_at) ||
    new Date().toISOString();

  const currentPeriodStart =
    secondsToIso(subscription.current_start) ??
    eventAt;

  const currentPeriodEnd =
    secondsToIso(subscription.current_end) ??
    eventAt;

  const trialStart = secondsToIso(subscription.start_at);
  let trialEnd = secondsToIso(subscription.charge_at);
  const eventId =
    payload.id ||
    payload.event_id ||
    `${event}:${subscription.id}:${eventAt}:${subscription.status || ""}:${subscription.plan_id || ""}`;

  // ─── STEP 1: ATOMIC IDEMPOTENCY CLAIM ────────────────────────────────────
  const { error: claimError } = await supabaseServer
    .from("processed_webhook_events")
    .insert({
      provider: "razorpay",
      event_id: eventId,
      event_type: event,
    });

  if (claimError) {
    if (
      claimError.code === "23505" ||
      claimError.message?.toLowerCase().includes("duplicate") ||
      claimError.details?.toLowerCase().includes("already exists")
    ) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[Billing Webhook] Failed to claim event:", claimError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const { data: existingSub, error: existingSubError } = await supabaseServer
    .from("subscriptions")
    .select("id, last_billing_event_at, last_billing_event_id")
    .eq("razorpay_subscription_id", subscription.id)
    .maybeSingle();

  if (existingSubError) {
    console.error("[Billing Webhook] Failed to read existing subscription:", existingSubError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (
    existingSub?.last_billing_event_at &&
    new Date(eventAt).getTime() < new Date(existingSub.last_billing_event_at).getTime()
  ) {
    return NextResponse.json({ received: true, skipped: "stale_event" });
  }

  // Determine local status mapping. 
  // Initialize to a safe, non-active default to prevent accidental early access.
  let localStatus = "trialing";

  switch (event) {
    case "subscription.created":
      localStatus = "trialing";
      break;
    case "subscription.authenticated":
      localStatus = "trialing";
      break;
    case "subscription.activated":
      localStatus = "active";
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
      else if (subscription.status === "created" || subscription.status === "authenticated") localStatus = "trialing";
      break;
    default:
      console.log(`[Billing Webhook] Unhandled event type: ${event}`);
      return NextResponse.json({ received: true, skipped: "unhandled_event" });
  }

  // Safely transition unpaid/abandoned replacement subscriptions to expired.
  if (
    localStatus === "cancelled" &&
    replacesSubId &&
    (subscription.paid_count ?? 0) === 0
  ) {
    localStatus = "expired";
  }

  // charge_at is the next billing date and stays in the future for active subs;
  // only use it to set trial_end when the subscription is still trialing.
  if (localStatus === "trialing" && subscription.charge_at) {
    trialEnd = secondsToIso(subscription.charge_at);
  }

  // ─── ATOMIC POSTGRES TRANSACTION VIA RPC ─────────────────────────────────
  // First attempt single-transaction RPC processing
  let shouldCancelReplacement = false;
  let rpcSuccess = false;

  try {
    const { data: rpcData, error: rpcErr } = await supabaseServer.rpc(
      "process_razorpay_billing_webhook",
      {
        p_provider: "razorpay",
        p_event_id: eventId,
        p_event_type: event,
        p_user_id: userId,
        p_plan_code: resolvedPlan.plan_code,
        p_billing_cycle: resolvedPlan.billing_cycle,
        p_status: localStatus,
        p_razorpay_subscription_id: subscription.id,
        p_razorpay_customer_id: subscription.customer_id || null,
        p_razorpay_plan_id: subscription.plan_id || null,
        p_replaces_sub_id: replacesSubId || null,
        p_current_period_start: currentPeriodStart,
        p_current_period_end: currentPeriodEnd,
        p_event_at: eventAt,
        p_trial_start: trialStart || null,
        p_trial_end: trialEnd || null,
      }
    );

    if (!rpcErr && rpcData) {
      rpcSuccess = true;
      if (rpcData.duplicate) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (rpcData.stale) {
        return NextResponse.json({ received: true, skipped: "stale_event" });
      }
      shouldCancelReplacement = Boolean(rpcData.should_cancel_replacement);
    }
  } catch {
    rpcSuccess = false;
  }

  // Fallback if RPC is not deployed in database yet
  if (!rpcSuccess) {
    // ─── STEP 1: ATOMIC IDEMPOTENCY CLAIM ────────────────────────────────────
    const { error: claimError } = await supabaseServer
      .from("processed_webhook_events")
      .insert({
        provider: "razorpay",
        event_id: eventId,
        event_type: event,
      });

    if (claimError) {
      if (
        claimError.code === "23505" ||
        claimError.message?.toLowerCase().includes("duplicate") ||
        claimError.details?.toLowerCase().includes("already exists")
      ) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("[Billing Webhook] Failed to claim event:", claimError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const { data: existingSub, error: existingSubError } = await supabaseServer
      .from("subscriptions")
      .select("id, last_billing_event_at, last_billing_event_id")
      .eq("razorpay_subscription_id", subscription.id)
      .maybeSingle();

    if (existingSubError) {
      console.error("[Billing Webhook] Failed to read existing subscription:", existingSubError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (
      existingSub?.last_billing_event_at &&
      new Date(eventAt).getTime() < new Date(existingSub.last_billing_event_at).getTime()
    ) {
      return NextResponse.json({ received: true, skipped: "stale_event" });
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
          replaces_razorpay_subscription_id: localStatus === "active" ? null : replacesSubId,
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

    if ((event === "subscription.activated" || event === "subscription.charged") && replacesSubId) {
      const { data: oldSub } = await supabaseServer
        .from("subscriptions")
        .select("id, status")
        .eq("razorpay_subscription_id", replacesSubId)
        .maybeSingle();

      if (oldSub && ["active", "trialing", "grace_period", "past_due"].includes(oldSub.status)) {
        shouldCancelReplacement = true;
        await supabaseServer
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("razorpay_subscription_id", replacesSubId);

        await supabaseServer.from("subscription_events").insert({
          subscription_id: oldSub.id,
          user_id: userId,
          event_type: "subscription.replaced",
          new_status: "cancelled",
          metadata: { reason: "replaced_by_upi_plan_change", new_subscription_id: subscription.id },
          created_at: new Date().toISOString()
        });
      }
    }
  }

  // ─── POST-COMMIT EXTERNAL RAZORPAY MUTATION ───────────────────────────────
  if (shouldCancelReplacement && replacesSubId) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("[Billing Webhook] Razorpay keys missing, cannot cancel old subscription.");
    } else {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        await razorpay.subscriptions.cancel(replacesSubId, false);
      } catch (err: any) {
        const msg = err?.error?.description || err?.message || "";
        if (msg.toLowerCase().includes("already cancelled")) {
          console.log("[Billing Webhook] Subscription already cancelled on Razorpay:", replacesSubId);
        } else {
          console.error("[Billing Webhook] Failed to cancel old subscription:", err);
        }
      }
    }
  }

  // Best-effort notification side effect (non-blocking)
  handleBillingNotification({
    userId,
    event,
    eventId,
    subscription,
    planCode: resolvedPlan.plan_code,
    billingCycle: resolvedPlan.billing_cycle,
    currentPeriodEnd,
  }).catch((err) => {
    console.error("[Billing Webhook] Notification dispatch error:", err);
  });

  return NextResponse.json({ received: true, status: localStatus });
}
