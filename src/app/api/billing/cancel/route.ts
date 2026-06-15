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
    // We cancel pending replacements BEFORE the active subscription. If the server crashes
    // mid-execution, we want the active subscription to remain active so the user can retry.
    // If we cancelled the active subscription first, a retry would be blocked (because the DB
    // says the active subscription is already cancelled), permanently leaving billable pending
    // replacements orphaned in Razorpay.
    const cancelledPendingIds: string[] = [];

    for (const pending of pendingReplacementsList) {
      if (pending.razorpay_subscription_id) {
        console.log("[Billing Cancel] Cancelling pending replacement:", pending.razorpay_subscription_id);
        try {
          await razorpay.subscriptions.cancel(pending.razorpay_subscription_id, false);
          cancelledPendingIds.push(pending.id);
        } catch (err: any) {
          if (isAlreadyCancelledError(err)) {
            console.log(`[Billing Cancel] Pending replacement ${pending.razorpay_subscription_id} was already cancelled.`);
            cancelledPendingIds.push(pending.id);
          } else {
            console.error(`[Billing Cancel] Failed to cancel pending replacement ${pending.razorpay_subscription_id}:`, err);
          }
        }
      }
    }

    // Abort if any pending replacement failed to cancel
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
    try {
      await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, 1);
    } catch (err: any) {
      if (isAlreadyCancelledError(err)) {
        console.log(`[Billing Cancel] Active subscription ${sub.razorpay_subscription_id} was already cancelled.`);
      } else {
        throw err; // Handled by outer catch
      }
    }

    // 3. Update database only after successful Razorpay operations
    const updatePromises = [
      supabaseServer.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id)
    ];

    if (cancelledPendingIds.length > 0) {
      updatePromises.push(
        supabaseServer.from("subscriptions").update({ status: "expired" }).in("id", cancelledPendingIds)
      );
    }

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(
      "[Billing Cancel] Failed to cancel Razorpay subscription:",
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
