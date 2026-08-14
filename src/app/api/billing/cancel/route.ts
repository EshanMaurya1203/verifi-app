import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { cancelAllUserSubscriptions } from "@/lib/billing/subscription-cancellation";

/**
 * Initiates subscription cancellation at the end of the current period.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = await checkRateLimit(identifier, 60000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Get active subscription from local DB to verify user has a cancellable subscription
  const { data: sub, error: subError } = await supabaseServer
    .from("subscriptions")
    .select("id, razorpay_subscription_id, status, plan_code, replaces_razorpay_subscription_id")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .is("replaces_razorpay_subscription_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError || !sub) {
    return NextResponse.json({ error: "No active subscription found to cancel." }, { status: 404 });
  }

  if (!sub.razorpay_subscription_id) {
    return NextResponse.json({ error: "Missing Razorpay subscription id." }, { status: 400 });
  }

  // Delegate cancellation to shared service (immediate: false -> cycle-end cancel for active sub, immediate for pending replacements)
  const result = await cancelAllUserSubscriptions(user.id, { immediate: false });

  if (!result.success) {
    console.error("[Billing Cancel] Cancellation failed:", result.error);
    return NextResponse.json(
      { error: result.error || "Failed to process cancellation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
