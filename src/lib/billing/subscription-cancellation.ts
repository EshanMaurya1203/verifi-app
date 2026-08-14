import Razorpay from "razorpay";
import { supabaseServer } from "@/lib/supabase-server";

export interface CancelSubscriptionsResult {
  success: boolean;
  discoveredCount: number;
  cancelledActiveCount: number;
  cancelledPendingCount: number;
  error?: string;
}

/**
 * Checks if a Razorpay error indicates that the subscription is already in a non-cancellable/cancelled state.
 */
export function isAlreadyCancelledError(err: unknown): boolean {
  const rzpErr = err as {
    statusCode?: number;
    error?: {
      code?: string;
      description?: string;
    };
  };

  return (
    rzpErr?.statusCode === 400 &&
    rzpErr?.error?.code === "BAD_REQUEST_ERROR" &&
    typeof rzpErr?.error?.description === "string" &&
    rzpErr.error.description.toLowerCase().includes("not cancellable")
  );
}

/**
 * Discovers, cancels, and verifies all provider-backed Razorpay subscriptions for a user.
 *
 * Requirements:
 * 1. Fails closed: If discovery query fails, returns success: false.
 * 2. Pending replacements are cancelled FIRST and immediately (cancel_at_cycle_end = false).
 * 3. Primary subscriptions are cancelled immediately if options.immediate === true (e.g. account deletion)
 *    or at cycle end if options.immediate === false (normal billing cancellation).
 * 4. Provider verification is mandatory via subscriptions.fetch.
 * 5. Already-cancelled provider subscriptions (confirmed via fetch) are treated as successfully cancelled.
 * 6. If provider cancellation succeeds but local DB bookkeeping fails, logs the error and still returns success: true.
 */
export async function cancelAllUserSubscriptions(
  userId: string,
  options: { immediate: boolean }
): Promise<CancelSubscriptionsResult> {
  const result: CancelSubscriptionsResult = {
    success: false,
    discoveredCount: 0,
    cancelledActiveCount: 0,
    cancelledPendingCount: 0,
  };

  // ── Step 1: Discover All Subscriptions for User ──────────────────────────
  const nowIso = new Date().toISOString();
  const { data: subs, error: selectError } = await supabaseServer
    .from("subscriptions")
    .select("id, razorpay_subscription_id, status, plan_code, replaces_razorpay_subscription_id, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "grace_period", "cancelled"])
    .not("razorpay_subscription_id", "is", null);

  if (selectError) {
    console.error("[SubscriptionCancellation] Failed to discover subscriptions (failing closed):", selectError);
    result.error = `Database discovery error: ${selectError.message}`;
    return result;
  }

  const allSubs = subs || [];
  result.discoveredCount = allSubs.length;

  // If user has zero provider-backed subscriptions, return success immediately.
  if (allSubs.length === 0) {
    result.success = true;
    return result;
  }

  // Filter subscriptions that need active cancellation
  // A. Pending replacements: trialing with replaces_razorpay_subscription_id set
  const pendingReplacements = allSubs.filter(
    (s) => s.status === "trialing" && s.replaces_razorpay_subscription_id != null
  );

  // B. Current primary subscriptions: not a pending replacement
  const primarySubs = allSubs.filter(
    (s) => s.replaces_razorpay_subscription_id == null && (
      s.status === "active" ||
      s.status === "trialing" ||
      s.status === "past_due" ||
      s.status === "grace_period" ||
      (s.status === "cancelled" && s.current_period_end && new Date(s.current_period_end).getTime() > new Date(nowIso).getTime())
    )
  );

  if (pendingReplacements.length === 0 && primarySubs.length === 0) {
    // All existing subscriptions are already expired or terminal past period_end
    result.success = true;
    return result;
  }

  // Ensure Razorpay credentials are present
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("[SubscriptionCancellation] Missing Razorpay API keys");
    result.error = "Razorpay billing keys are not configured";
    return result;
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const cancelledPendingIds: string[] = [];
  const cancelledPrimaryIds: string[] = [];
  let primaryDbStatusUpdate: string = "cancelled";

  try {
    // ── Step 2: Cancel Pending Replacements FIRST (Always Immediate) ────────
    for (const pending of pendingReplacements) {
      const subId = pending.razorpay_subscription_id!;
      console.log(`[SubscriptionCancellation] Cancelling pending replacement: ${subId}`);

      let isCancelled = false;
      try {
        await razorpay.subscriptions.cancel(subId, false);
        const verification = await razorpay.subscriptions.fetch(subId);
        if (verification.status === "cancelled") {
          isCancelled = true;
        } else {
          console.error(`[SubscriptionCancellation] Pending replacement ${subId} status mismatch after cancel:`, verification.status);
        }
      } catch (err: unknown) {
        if (isAlreadyCancelledError(err)) {
          const verification = await razorpay.subscriptions.fetch(subId);
          if (verification.status === "cancelled") {
            console.log(`[SubscriptionCancellation] Pending replacement ${subId} was already cancelled.`);
            isCancelled = true;
          } else {
            console.error(`[SubscriptionCancellation] Pending replacement ${subId} reported not cancellable but fetch status is ${verification.status}`);
          }
        } else {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[SubscriptionCancellation] Error cancelling pending replacement ${subId}:`, errMsg);
        }
      }

      if (!isCancelled) {
        result.error = `Failed to cancel and verify pending replacement subscription ${subId}`;
        return result;
      }

      cancelledPendingIds.push(pending.id);
      result.cancelledPendingCount++;
    }

    // ── Step 3: Cancel Primary Subscriptions ────────────────────────────────
    for (const primary of primarySubs) {
      const subId = primary.razorpay_subscription_id!;
      const cancelAtCycleEnd = !options.immediate; // false = immediate for account deletion; true = cycle-end for normal cancel
      console.log(`[SubscriptionCancellation] Cancelling primary subscription: ${subId} (immediate=${options.immediate})`);

      let isVerified = false;
      try {
        await razorpay.subscriptions.cancel(subId, cancelAtCycleEnd);
        const verification = await razorpay.subscriptions.fetch(subId);

        if (options.immediate) {
          if (verification.status === "cancelled") {
            isVerified = true;
            primaryDbStatusUpdate = "expired";
          } else {
            console.error(`[SubscriptionCancellation] Primary subscription ${subId} immediate cancel mismatch:`, verification.status);
          }
        } else {
          // Normal billing cancel: status may be active with scheduled changes, or cancelled
          if (verification.status === "active" || verification.status === "cancelled") {
            isVerified = true;
            primaryDbStatusUpdate = "cancelled";
          } else {
            console.error(`[SubscriptionCancellation] Primary subscription ${subId} cycle-end cancel mismatch:`, verification.status);
          }
        }
      } catch (err: unknown) {
        if (isAlreadyCancelledError(err)) {
          const verification = await razorpay.subscriptions.fetch(subId);
          if (verification.status === "cancelled") {
            console.log(`[SubscriptionCancellation] Primary subscription ${subId} was already cancelled.`);
            isVerified = true;
            primaryDbStatusUpdate = options.immediate ? "expired" : "cancelled";
          } else {
            console.error(`[SubscriptionCancellation] Primary subscription ${subId} not cancellable but fetch status is ${verification.status}`);
          }
        } else {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[SubscriptionCancellation] Error cancelling primary subscription ${subId}:`, errMsg);
        }
      }

      if (!isVerified) {
        result.error = `Failed to cancel and verify primary subscription ${subId}`;
        return result;
      }

      cancelledPrimaryIds.push(primary.id);
      result.cancelledActiveCount++;
    }

    // ── Step 4: Local DB Bookkeeping (Non-blocking for provider safety) ─────
    try {
      const updatePromises = [];

      if (cancelledPrimaryIds.length > 0) {
        updatePromises.push(
          supabaseServer
            .from("subscriptions")
            .update({ status: primaryDbStatusUpdate })
            .in("id", cancelledPrimaryIds)
        );
      }

      if (cancelledPendingIds.length > 0) {
        updatePromises.push(
          supabaseServer
            .from("subscriptions")
            .update({ status: "expired" })
            .in("id", cancelledPendingIds)
        );
      }

      await Promise.all(updatePromises);
    } catch (bookkeepingError) {
      // Provider cancellation succeeded and is verified; DB bookkeeping failure does not invalidate safety
      console.warn("[SubscriptionCancellation] Non-fatal DB bookkeeping update error:", bookkeepingError);
    }

    result.success = true;
    return result;
  } catch (unexpectedError: unknown) {
    const msg = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    console.error("[SubscriptionCancellation] Unexpected exception during subscription cancellation:", msg);
    result.error = msg;
    return result;
  }
}
