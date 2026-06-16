import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

function isAlreadyCancelledError(err: any): boolean {
  return (
    err?.statusCode === 400 &&
    err?.error?.code === "BAD_REQUEST_ERROR" &&
    typeof err?.error?.description === "string" &&
    err.error.description.includes("not cancellable")
  );
}

/**
 * Initiates subscription cancellation at the end of the current period.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 60000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Get active subscription from local DB
  const { data: sub, error: subError } = await supabaseServer
    .from("subscriptions")
    .select(`id, razorpay_subscription_id, status, plan_code, replaces_razorpay_subscription_id`)
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .is("replaces_razorpay_subscription_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError || !sub) {
    return NextResponse.json({ error: "No active subscription found to cancel." }, { status: 404 });
  }

  // Get all pending replacement subscriptions associated with this active subscription
  const { data: pendingReplacements, error: pendingError } = await supabaseServer
    .from("subscriptions")
    .select("id, razorpay_subscription_id")
    .eq("user_id", user.id)
    .eq("status", "trialing")
    .eq("replaces_razorpay_subscription_id", sub.razorpay_subscription_id);

  if (pendingError) {
    console.error("[Billing Cancel] Failed to fetch pending replacements:", pendingError);
  }
  const pendingReplacementsList = pendingReplacements || [];

  if (!sub.razorpay_subscription_id) {
    return NextResponse.json({ error: "Missing Razorpay subscription id." }, { status: 400 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Razorpay billing keys are not configured" },
      { status: 500 }
    );
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  try {
    // 1. Cancel all pending replacement subscriptions immediately
    const cancelledPendingIds: string[] = [];

    for (const pending of pendingReplacementsList) {
      if (pending.razorpay_subscription_id) {
        console.log("[Billing Cancel] Cancelling pending replacement:", pending.razorpay_subscription_id);
        try {
          // Pass false to cancel immediately
          const response = await razorpay.subscriptions.cancel(pending.razorpay_subscription_id, false);
          console.log(
            "[Billing Cancel] Razorpay cancel response (pending):",
            JSON.stringify(response, null, 2)
          );

          const verification = await razorpay.subscriptions.fetch(pending.razorpay_subscription_id);
          console.log(
            "[Billing Cancel] Verification fetch (pending):",
            JSON.stringify(verification, null, 2)
          );

          if (verification.status !== "cancelled") {
            console.error(
              "[CRITICAL BILLING ALIGNMENT] Razorpay status mismatch for pending replacement. Expected cancelled.",
              verification
            );
          } else {
            console.log(`[Billing Cancel] Successfully cancelled subscription ${pending.razorpay_subscription_id}`);
            cancelledPendingIds.push(pending.id);
          }
        } catch (err: any) {
          if (isAlreadyCancelledError(err)) {
            console.log(`[Billing Cancel] Pending replacement ${pending.razorpay_subscription_id} was already cancelled.`);
            cancelledPendingIds.push(pending.id);
          } else {
            console.error(`[Billing Cancel] Failed to cancel pending replacement ${pending.razorpay_subscription_id}:`, err);
            console.error("[Billing Cancel] Razorpay cancel error payload:", JSON.stringify(err, null, 2));
          }
        }
      }
    }

    if (cancelledPendingIds.length < pendingReplacementsList.length) {
      console.error(`[CRITICAL BILLING ALIGNMENT] Aborting cancellation. Failed to cancel pending replacement subscriptions.`);
      return NextResponse.json(
        {
          error: "We encountered an error cancelling your scheduled plan change. Your active subscription has not been cancelled yet. Please contact support."
        },
        { status: 500 }
      );
    }

    // 2. Cancel the active subscription at period end
    console.log("[Billing Cancel] Cancelling active subscription:", sub.razorpay_subscription_id);
    let activeDbStatusUpdate: string | null = null;

    try {
      // Pass true to cancel at cycle end (second parameter must be a boolean per Razorpay SDK)
      const response = await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, true);
      console.log(
        "[Billing Cancel] Razorpay cancel response (active):",
        JSON.stringify(response, null, 2)
      );

      const verification = await razorpay.subscriptions.fetch(sub.razorpay_subscription_id);
      console.log(
        "[Billing Cancel] Verification fetch (active):",
        JSON.stringify(verification, null, 2)
      );

      // Razorpay leaves the subscription as "active" but with has_scheduled_changes: true or cancel_at_cycle_end: 1
      if (verification.status === "active") {
        console.log(`[Billing Cancel] Successfully scheduled cancellation for subscription ${sub.razorpay_subscription_id}. Status remains active until period end.`);
        // Database should accurately mirror Razorpay lifecycle state. 
        // We will NOT mark it as cancelled. The existing schema treats `status: cancelled` with `current_period_end > now` as active,
        // which serves as our "scheduled_for_cancellation" equivalent state. We map it to "cancelled" locally to reflect this pending-cancellation state 
        // to the UI, since our DB check constraints only allow: 'active', 'trialing', 'grace_period', 'past_due', 'cancelled', 'expired'.
        activeDbStatusUpdate = "cancelled"; 
      } else if (verification.status === "cancelled") {
        console.log(`[Billing Cancel] Successfully cancelled subscription ${sub.razorpay_subscription_id}.`);
        activeDbStatusUpdate = "cancelled";
      } else {
        console.error(
          "[CRITICAL BILLING ALIGNMENT] Razorpay status mismatch for active subscription. Unexpected status.",
          verification
        );
      }
    } catch (err: any) {
      if (isAlreadyCancelledError(err)) {
        console.log(`[Billing Cancel] Active subscription ${sub.razorpay_subscription_id} was already cancelled.`);
        activeDbStatusUpdate = "cancelled";
      } else {
        console.error(
          "[Billing Cancel] Failed to cancel Razorpay active subscription:",
          JSON.stringify(err, null, 2)
        );
        throw err;
      }
    }

    // 3. Update database only after successful Razorpay operations
    const updatePromises = [];

    if (activeDbStatusUpdate) {
      updatePromises.push(
        supabaseServer.from("subscriptions").update({ status: activeDbStatusUpdate }).eq("id", sub.id)
      );
    }

    if (cancelledPendingIds.length > 0) {
      updatePromises.push(
        supabaseServer.from("subscriptions").update({ status: "expired" }).in("id", cancelledPendingIds)
      );
    }

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(
      "[Billing Cancel] Failed to process cancellation flow:",
      JSON.stringify(error, null, 2)
    );

    return NextResponse.json(
      {
        error: "Failed to process cancellation",
        razorpayError: error?.error || error?.message || error
      },
      { status: 500 }
    );
  }
}
