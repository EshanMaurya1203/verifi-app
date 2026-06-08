import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

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
    .select("id, razorpay_subscription_id, status")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError || !sub) {
    return NextResponse.json({ error: "No active subscription found to cancel." }, { status: 404 });
  }

  if (!sub.razorpay_subscription_id) {
    return NextResponse.json({ error: "Missing Razorpay subscription id." }, { status: 400 });
  }

  const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || ""
  });

  try {
    // Cancel at period end
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, 1);
    
    // We don't update local state here; we rely on the webhook
    // which will eventually update subscriptions.status = 'cancelled'

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Billing Cancel] Failed to cancel Razorpay subscription:", error);
    return NextResponse.json({ error: "Failed to process cancellation" }, { status: 500 });
  }
}
